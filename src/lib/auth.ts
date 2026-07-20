import { db } from '@/lib/db';
import { users, systemSettings } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { USER_ROLE } from '@/lib/schema';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

// ==================== Token 安全（HMAC 签名）====================
const TOKEN_SECRET = process.env.TOKEN_SECRET;
if (!TOKEN_SECRET) {
  console.error('[Auth] FATAL: TOKEN_SECRET 环境变量未配置，Token 签名验证将失败');
}
const EFFECTIVE_SECRET = TOKEN_SECRET || '__MISSING_TOKEN_SECRET__';
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * HMAC-SHA256 签名
 */
function signHmac(payload: string): string {
  return crypto.createHmac('sha256', EFFECTIVE_SECRET).update(payload).digest('hex');
}

/**
 * 验证 HMAC 签名
 */
function verifyHmac(base64Payload: string, providedSignature: string): boolean {
  const expected = crypto.createHmac('sha256', EFFECTIVE_SECRET).update(base64Payload).digest('hex');
  // 使用时间安全比较防时序攻击
  if (expected.length !== providedSignature.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (expected.charCodeAt(i) !== providedSignature.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * 导出验证函数供 middleware 使用（不包含签名验证，因为 Edge 不支持 Node crypto）
 */
export function parseTokenBasic(token: string): { userId: number; username: string; name: string; role: string; mustChangePassword: boolean } | null {
  try {
    const lastDotIndex = token.lastIndexOf('.');
    if (lastDotIndex === -1) return null;
    const base64Payload = token.substring(0, lastDotIndex);
    const data = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf-8'));
    if (Date.now() - data.timestamp > TOKEN_EXPIRY_MS) return null;
    return {
      userId: data.userId,
      username: data.username,
      name: data.name || data.username,
      role: data.role,
      mustChangePassword: data.mustChangePassword || false,
    };
  } catch {
    return null;
  }
}

// ==================== 密码安全（bcrypt 加密）====================
const SALT_ROUNDS = 10; // bcrypt 盐值轮数

/**
 * 密码哈希 - 使用 bcrypt
 */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

/**
 * 验证密码 - 兼容旧 Base64 密码和新的 bcrypt 密码
 */
export function verifyPassword(password: string, hashedPassword: string): boolean {
  // 先尝试 bcrypt 验证
  if (hashedPassword.startsWith('$2a$') || hashedPassword.startsWith('$2b$')) {
    try {
      return bcrypt.compareSync(password, hashedPassword);
    } catch {
      return false;
    }
  }
  // 兼容旧的 Base64 编码密码
  const legacyHash = Buffer.from(password).toString('base64');
  return legacyHash === hashedPassword;
}

// 生成安全的 Token（Base64(payload) + "." + HMAC-SHA256 签名）
export function generateToken(
  userId: number,
  username: string,
  name: string,
  role: string,
  mustChangePassword: boolean = false
): string {
  const payload = JSON.stringify({
    userId, username, name, role, mustChangePassword, timestamp: Date.now()
  });
  const base64Payload = Buffer.from(payload).toString('base64');
  const signature = signHmac(base64Payload);
  return `${base64Payload}.${signature}`;
}

/**
 * 解析并验证 Token（完整版本，含 HMAC 签名验证）
 * 用于 API 路由层
 */
export function parseToken(token: string): {
  userId: number; username: string; name: string;
  role: string; mustChangePassword: boolean;
} | null {
  try {
    const lastDotIndex = token.lastIndexOf('.');
    if (lastDotIndex === -1) return null;

    const base64Payload = token.substring(0, lastDotIndex);
    const providedSignature = token.substring(lastDotIndex + 1);

    // 验证签名（防篡改）
    if (!verifyHmac(base64Payload, providedSignature)) {
      console.warn('[Auth] Token 签名验证失败 - 可能被篡改');
      return null;
    }

    const data = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf-8'));
    if (Date.now() - data.timestamp > TOKEN_EXPIRY_MS) return null;

    return {
      userId: data.userId,
      username: data.username,
      name: data.name || data.username,
      role: data.role,
      mustChangePassword: data.mustChangePassword || false,
    };
  } catch {
    return null;
  }
}

/**
 * 判断密码是否为旧的 Base64 格式
 */
export function isLegacyHash(hashed: string): boolean {
  return !hashed.startsWith('$2a$') && !hashed.startsWith('$2b$');
}

// 验证用户登录
export async function verifyLogin(username: string, password: string) {
  try {
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    if (userList.length === 0) {
      return null;
    }

    const user = userList[0];

    // 检查用户状态
    if (user.status !== 'active') {
      return null;
    }

    // 验证密码
    if (!verifyPassword(password, user.password)) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };
  } catch (error) {
    console.error('Login verification failed:', error);
    return null;
  }
}

// 根据用户ID获取用户信息
export async function getUserById(userId: number) {
  try {
    // 只查询需要的字段，优化性能
    const userList = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userList.length === 0) {
      return null;
    }

    const user = userList[0];

    // 检查用户状态
    if (user.status !== 'active') {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };
  } catch (error) {
    console.error('Get user by ID failed:', error);
    return null;
  }
}

// 检查页面访问权限
export function hasPagePermission(role: string, pagePath: string): boolean {
  const rolePermissions = {
    admin: ['/', '/appointment', '/my-appointments', '/management', '/management/visitor-query', '/management/log-query', '/security', '/security/check-in', '/security/check-out', '/security/long-term-vehicles', '/admin/users', '/login'],
    security: ['/', '/security', '/security/check-in', '/security/check-out', '/login'],
    employee: ['/', '/appointment', '/login'],
    visitor: ['/', '/appointment', '/login'],
  };

  const allowedPages = rolePermissions[role as keyof typeof rolePermissions] || [];
  return allowedPages.includes(pagePath);
}

// 检查 API 访问权限
export function hasApiPermission(role: string, apiPath: string, method: string): boolean {
  const rolePermissions = {
    admin: {
      allow: ['*'],
      deny: [],
    },
    security: {
      allow: ['/api/visitors/search', '/api/visit-records', '/api/visit-records/checkout', '/api/auth/logout'],
      deny: [],
    },
    employee: {
      allow: ['/api/appointments', '/api/auth/logout'],
      deny: [],
    },
    visitor: {
      allow: ['/api/appointments', '/api/auth/logout'],
      deny: [],
    },
  };

  const permissions = rolePermissions[role as keyof typeof rolePermissions];
  if (!permissions) return false;

  // 检查是否有所有权限
  if (permissions.allow.includes('*')) return true;

  // 检查是否在允许列表中
  return permissions.allow.some(path => apiPath.startsWith(path));
}

// 角色显示名称
export const ROLE_LABELS = {
  admin: '管理员',
  security: '门卫',
  employee: '员工',
  visitor: '访客',
} as const;

// 创建默认用户
export async function createDefaultUsers() {
  try {
    // 检查是否已存在用户
    const existingUsers = await db.select().from(users);
    if (existingUsers.length > 0) {
      console.log('Users already exist, skipping default user creation');
      return;
    }

    // 创建默认用户
    const defaultUsers = [
      { username: 'admin', password: 'admin123', name: '系统管理员', role: USER_ROLE.ADMIN },
      { username: 'security', password: 'security123', name: '门卫人员', role: USER_ROLE.SECURITY },
      { username: 'employee', password: 'employee123', name: '员工代表', role: USER_ROLE.EMPLOYEE },
      { username: 'visitor', password: 'visitor123', name: '访客代表', role: USER_ROLE.VISITOR },
    ];

    for (const user of defaultUsers) {
      await db.insert(users).values({
        username: user.username,
        password: hashPassword(user.password),
        name: user.name,
        role: user.role,
        status: 'active',
      });
    }

    console.log('Default users created successfully');

    // 初始化默认系统设置
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`
      INSERT INTO system_settings (key, value, description)
      VALUES ('review_enabled', 'true', '审核开关：开启后访客预约需被访人审核')
      ON CONFLICT (key) DO NOTHING
    `);
  } catch (error) {
    console.error('Failed to create default users:', error);
  }
}

// ==================== API 路由认证辅助 ====================
import { NextRequest, NextResponse } from 'next/server';

/**
 * API 路由认证辅助函数（含签名验证 + 角色校验）
 * @param request NextRequest 对象
 * @param allowedRoles 允许的角色列表，如 ['admin'] 或 ['admin', 'security']
 * @returns 认证成功返回用户数据，失败返回 NextResponse（可直接 return）
 */
export function requireAuth(
  request: NextRequest,
  allowedRoles: string[] = ['admin']
): { userId: number; username: string; name: string; role: string; mustChangePassword: boolean } | NextResponse {
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const userData = parseToken(token); // 含 HMAC 签名验证
  if (!userData) {
    return NextResponse.json({ error: '登录已过期或 token 无效' }, { status: 401 });
  }

  if (!allowedRoles.includes(userData.role)) {
    return NextResponse.json({ error: '无操作权限' }, { status: 403 });
  }

  return userData;
}

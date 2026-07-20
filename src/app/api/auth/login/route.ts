import { NextRequest, NextResponse } from 'next/server';
import { verifyLogin, generateToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { users, passwordPolicy } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

// ==================== 内存级速率限制 ====================
// 单 IP 限制
const ipAttempts = new Map<string, { count: number; resetAt: number }>();
const IP_RATE_LIMIT = 5; // 每分钟最多 5 次尝试
const IP_WINDOW_MS = 60 * 1000;

// 用户名限制（防暴力破解）
const usernameAttempts = new Map<string, { count: number; lockedUntil: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipAttempts.get(ip);
  if (!record || now > record.resetAt) {
    ipAttempts.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
    return true;
  }
  if (record.count >= IP_RATE_LIMIT) return false; // 超限
  record.count++;
  return true;
}

async function checkUserLockout(username: string): Promise<{ allowed: boolean; message?: string }> {
  // 先查数据库中的锁定策略
  try {
    const policies = await db.select().from(passwordPolicy).where(eq(passwordPolicy.isActive, true)).limit(1);
    const policy = policies[0];
    const lockoutMinutes = policy?.lockoutDuration || 30;

    const record = usernameAttempts.get(username);
    if (record && record.lockedUntil > Date.now()) {
      const remainingMin = Math.ceil((record.lockedUntil - Date.now()) / 60000);
      return { allowed: false, message: `账户已锁定，请 ${remainingMin} 分钟后重试` };
    }

    // 如果锁定已过期，清除计数
    if (record && record.lockedUntil > 0 && record.lockedUntil <= Date.now()) {
      usernameAttempts.delete(username);
    }

    return { allowed: true };
  } catch {
    return { allowed: true }; // 出错时放行
  }
}

async function recordFailedAttempt(username: string) {
  // 从数据库获取锁定策略配置
  let maxAttempts = 5;
  let lockoutMinutes = 30;
  try {
    const policies = await db.select().from(passwordPolicy).where(eq(passwordPolicy.isActive, true)).limit(1);
    const policy = policies[0];
    if (policy?.maxLoginAttempts) maxAttempts = policy.maxLoginAttempts;
    if (policy?.lockoutDuration) lockoutMinutes = policy.lockoutDuration;
  } catch {
    // 出错时使用默认值
  }

  const record = usernameAttempts.get(username);
  if (!record) {
    usernameAttempts.set(username, { count: 1, lockedUntil: 0 });
    return;
  }
  record.count++;
  if (record.count >= maxAttempts) {
    record.lockedUntil = Date.now() + lockoutMinutes * 60 * 1000;
  }
}

function clearFailedAttempts(username: string) {
  usernameAttempts.delete(username);
}

// POST - 用户登录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    // IP 级速率限制（防暴力扫描）
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, { status: 429 });
    }

    // 用户名级别锁定检查
    const lockCheck = await checkUserLockout(username);
    if (!lockCheck.allowed) {
      return NextResponse.json({ error: lockCheck.message }, { status: 423 }); // 423 Locked
    }

    // 验证登录
    const user = await verifyLogin(username, password);
    
    if (!user) {
      await recordFailedAttempt(username); // 记录失败尝试
      // 获取剩余尝试次数
      const record = usernameAttempts.get(username);
      let maxAttempts = 5;
      try {
        const policies = await db.select().from(passwordPolicy).where(eq(passwordPolicy.isActive, true)).limit(1);
        if (policies[0]?.maxLoginAttempts) maxAttempts = policies[0].maxLoginAttempts;
      } catch { /* 使用默认值 */ }
      const failedCount = record?.count || 1;
      const remaining = maxAttempts - failedCount;
      if (remaining <= 0) {
        return NextResponse.json({ error: '登录失败次数过多，账户已被锁定' }, { status: 423 });
      }
      return NextResponse.json({ error: `用户名或密码错误，还剩 ${remaining} 次尝试机会` }, { status: 401 });
    }

    // 登录成功，清除失败计数
    clearFailedAttempts(username);

    // 检查用户状态
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const fullUser = userList[0];

    if (fullUser.status !== 'active') {
      return NextResponse.json({ error: '用户已被禁用' }, { status: 401 });
    }

    // 检查密码是否需要修改
    const mustChangePassword = fullUser.mustChangePassword || false;

    // 生成 token（包含 mustChangePassword 字段）
    const token = generateToken(user.id, user.username, user.name, user.role, mustChangePassword);

    // 设置 cookie - 使用 NextResponse 显式返回 cookie
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const isSecure = forwardedProto === 'https' || (process.env.NODE_ENV === 'production' && request.nextUrl.protocol === 'https:');
    const response = NextResponse.json({
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
      mustChangePassword: mustChangePassword,
    });
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}

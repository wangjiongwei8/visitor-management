import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, passwordHistory, passwordPolicy } from '@/storage/database/shared/schema';
import { eq, desc } from 'drizzle-orm';
import { parseToken, hashPassword, verifyPassword, generateToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// 验证密码复杂度
function validatePassword(password: string, policy: {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  specialChars?: string | null;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < policy.minLength) {
    errors.push(`密码长度不能少于 ${policy.minLength} 位`);
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母');
  }

  if (policy.requireNumber && !/[0-9]/.test(password)) {
    errors.push('密码必须包含数字');
  }

  if (policy.requireSpecialChar && policy.specialChars) {
    const specialCharsRegex = new RegExp(`[${policy.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
    if (!specialCharsRegex.test(password)) {
      errors.push(`密码必须包含特殊字符（${policy.specialChars}）`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// POST - 修改密码
export async function POST(request: NextRequest) {
  try {
    // 验证登录状态
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userData = parseToken(token);
    if (!userData) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    // 获取用户完整信息（包含密码）
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.id, userData.userId));

    if (userList.length === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 401 });
    }

    const user = userList[0];

    // 检查用户状态
    if (user.status !== 'active') {
      return NextResponse.json({ error: '用户已被禁用' }, { status: 401 });
    }

    const body = await request.json();
    const { oldPassword, newPassword, forceChange } = body;

    // 验证必填字段
    if (!newPassword) {
      return NextResponse.json({ error: '请填写新密码' }, { status: 400 });
    }

    // 如果不是强制修改，需要验证旧密码
    if (!forceChange && !oldPassword) {
      return NextResponse.json({ error: '请填写原密码' }, { status: 400 });
    }

    // 验证旧密码（非强制修改时）
    if (!forceChange && !verifyPassword(oldPassword, user.password)) {
      return NextResponse.json({ error: '原密码错误' }, { status: 400 });
    }

    // 获取密码策略
    const policies = await db
      .select()
      .from(passwordPolicy)
      .where(eq(passwordPolicy.isActive, true))
      .limit(1);

    const policy = policies[0] || {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecialChar: true,
      specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
      maxPasswordAge: 90,
      passwordHistoryCount: 5,
    };

    // 验证密码复杂度
    const validation = validatePassword(newPassword, policy);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join('，') }, { status: 400 });
    }

    // 检查密码是否与当前密码相同
    if (verifyPassword(newPassword, user.password)) {
      return NextResponse.json({ error: '新密码不能与当前密码相同' }, { status: 400 });
    }

    // 检查历史密码
    if (policy.passwordHistoryCount && policy.passwordHistoryCount > 0) {
      const history = await db
        .select()
        .from(passwordHistory)
        .where(eq(passwordHistory.userId, user.id))
        .orderBy(desc(passwordHistory.changedAt))
        .limit(policy.passwordHistoryCount);

      // 需要存储历史密码哈希，这里简化处理，只检查当前密码
      // 完整实现需要存储每次密码的哈希值
    }

    // 计算密码过期时间
    const now = new Date();
    let passwordExpiresAt: Date | null = null;
    if (policy.maxPasswordAge && policy.maxPasswordAge > 0) {
      passwordExpiresAt = new Date(now.getTime() + policy.maxPasswordAge * 24 * 60 * 60 * 1000);
    }

    // 更新密码
    const hashedPassword = hashPassword(newPassword);
    await db
      .update(users)
      .set({
        password: hashedPassword,
        mustChangePassword: false,
        passwordChangedAt: now,
        passwordExpiresAt: passwordExpiresAt,
        lastPasswordChangeBy: 'self',
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    // 记录密码修改历史
    await db.insert(passwordHistory).values({
      userId: user.id,
      changedAt: now,
      changedBy: user.username,
      changeType: forceChange ? 'initial_set' : 'self_change',
    });

    // 更新 token（mustChangePassword 设为 false）
    const newToken = generateToken(user.id, user.username, user.name || '', user.role, false);
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const isSecure = forwardedProto === 'https' || (process.env.NODE_ENV === 'production' && request.nextUrl.protocol === 'https:');
    
    // 使用 NextResponse 显式返回 cookie，确保客户端正确接收
    const response = NextResponse.json({ success: true, message: '密码修改成功' });
    response.cookies.set('auth-token', newToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('Failed to change password:', error);
    return NextResponse.json({ error: '修改密码失败' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { passwordPolicy } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { parseToken } from '@/lib/auth';

// GET - 获取密码策略
export async function GET() {
  try {
    // 验证管理员权限
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userData = parseToken(token);
    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    // 获取策略
    const policies = await db
      .select()
      .from(passwordPolicy)
      .where(eq(passwordPolicy.isActive, true))
      .limit(1);

    if (policies.length === 0) {
      // 返回默认策略
      return NextResponse.json({
        id: 0,
        name: 'default',
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecialChar: true,
        specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        maxPasswordAge: 90,
        passwordExpiryWarningDays: 7,
        passwordHistoryCount: 5,
        defaultPassword: '123456',
        forceChangeOnFirstLogin: true,
        maxLoginAttempts: 5,
        lockoutDuration: 30,
        isActive: true,
      });
    }

    return NextResponse.json(policies[0]);
  } catch (error) {
    console.error('Failed to fetch password policy:', error);
    return NextResponse.json({ error: '获取密码策略失败' }, { status: 500 });
  }
}

// POST - 保存密码策略
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userData = parseToken(token);
    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const body = await request.json();

    // 检查是否已存在策略
    const existing = await db
      .select()
      .from(passwordPolicy)
      .where(eq(passwordPolicy.isActive, true))
      .limit(1);

    if (existing.length > 0) {
      // 更新现有策略
      await db
        .update(passwordPolicy)
        .set({
          minLength: body.minLength,
          requireUppercase: body.requireUppercase,
          requireLowercase: body.requireLowercase,
          requireNumber: body.requireNumber,
          requireSpecialChar: body.requireSpecialChar,
          specialChars: body.specialChars,
          maxPasswordAge: body.maxPasswordAge,
          passwordExpiryWarningDays: body.passwordExpiryWarningDays,
          passwordHistoryCount: body.passwordHistoryCount,
          defaultPassword: body.defaultPassword,
          forceChangeOnFirstLogin: body.forceChangeOnFirstLogin,
          maxLoginAttempts: body.maxLoginAttempts,
          lockoutDuration: body.lockoutDuration,
          updatedAt: new Date(),
        })
        .where(eq(passwordPolicy.id, existing[0].id));
    } else {
      // 创建新策略
      await db.insert(passwordPolicy).values({
        name: 'default',
        minLength: body.minLength,
        requireUppercase: body.requireUppercase,
        requireLowercase: body.requireLowercase,
        requireNumber: body.requireNumber,
        requireSpecialChar: body.requireSpecialChar,
        specialChars: body.specialChars,
        maxPasswordAge: body.maxPasswordAge,
        passwordExpiryWarningDays: body.passwordExpiryWarningDays,
        passwordHistoryCount: body.passwordHistoryCount,
        defaultPassword: body.defaultPassword,
        forceChangeOnFirstLogin: body.forceChangeOnFirstLogin,
        maxLoginAttempts: body.maxLoginAttempts,
        lockoutDuration: body.lockoutDuration,
        isActive: true,
      });
    }

    return NextResponse.json({ success: true, message: '密码策略保存成功' });
  } catch (error) {
    console.error('Failed to save password policy:', error);
    return NextResponse.json({ error: '保存密码策略失败' }, { status: 500 });
  }
}

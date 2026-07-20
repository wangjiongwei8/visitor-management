import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, passwordHistory, passwordPolicy } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { parseToken, hashPassword } from '@/lib/auth';

// POST - 重置/初始化用户密码
// body.newPassword: 可选，指定新密码；不传则使用密码策略中的默认密码
// body.forceChange: 可选，是否强制用户下次登录修改密码；不传则按密码策略决定
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: '无效的用户ID' }, { status: 400 });
    }

    // 获取用户
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userList.length === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 解析请求体
    let body: { newPassword?: string; forceChange?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // 无请求体，使用默认密码
    }

    // 获取密码策略
    const policies = await db
      .select()
      .from(passwordPolicy)
      .where(eq(passwordPolicy.isActive, true))
      .limit(1);

    const policy = policies[0] || {
      defaultPassword: '123456',
      forceChangeOnFirstLogin: true,
    };

    // 确定使用的密码
    const newPassword = body.newPassword || policy.defaultPassword || '123456';
    const mustChange = body.forceChange !== undefined ? body.forceChange : (policy.forceChangeOnFirstLogin !== false);

    const hashedPassword = hashPassword(newPassword);
    const now = new Date();

    // 更新用户密码
    await db
      .update(users)
      .set({
        password: hashedPassword,
        mustChangePassword: mustChange,
        passwordChangedAt: now,
        lastPasswordChangeBy: userData.username,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    // 记录密码修改历史
    await db.insert(passwordHistory).values({
      userId: userId,
      changedAt: now,
      changedBy: userData.username,
      changeType: body.newPassword ? 'admin_init' : 'admin_reset',
    });

    return NextResponse.json({
      success: true,
      message: body.newPassword
        ? '密码初始化成功'
        : `密码已重置为默认密码（${newPassword}），用户首次登录时需修改`,
      mustChangePassword: mustChange,
    });
  } catch (error) {
    console.error('Failed to reset password:', error);
    return NextResponse.json({ error: '重置密码失败' }, { status: 500 });
  }
}

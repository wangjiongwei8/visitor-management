import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { parseToken, getUserById } from '@/lib/auth';
import { cookies } from 'next/headers';

// PUT - 更新用户（仅管理员）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证权限
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userData = parseToken(token);
    if (!userData) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const currentUser = await getUserById(userData.userId);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json({ error: '无效的用户ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, role, employeeId, department, phone } = body;

    // 检查用户是否存在
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (existingUser.length === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 更新用户
    await db.update(users)
      .set({
        name,
        role,
        employeeId,
        department,
        phone,
      })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: '更新用户失败' }, { status: 500 });
  }
}

// DELETE - 删除用户（仅管理员）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证权限
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userData = parseToken(token);
    if (!userData) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const currentUser = await getUserById(userData.userId);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json({ error: '无效的用户ID' }, { status: 400 });
    }

    // 不允许删除自己
    if (userId === userData.userId) {
      return NextResponse.json({ error: '不能删除当前登录用户' }, { status: 400 });
    }

    // 查询用户
    const userToDelete = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (userToDelete.length === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 系统管理员账户任何情况下都不可删除
    if (userToDelete[0].username === 'admin') {
      return NextResponse.json({ error: '系统管理员账户不可删除' }, { status: 400 });
    }

    // 删除用户
    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json({ error: '删除用户失败' }, { status: 500 });
  }
}

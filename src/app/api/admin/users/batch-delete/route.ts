import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/storage/database/shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { parseToken, getUserById } from '@/lib/auth';
import { cookies } from 'next/headers';

// POST - 批量删除用户（仅管理员）
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { ids } = body as { ids: number[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '请选择要删除的用户' }, { status: 400 });
    }

    // 查询要删除的用户
    const usersToDelete = await db
      .select()
      .from(users)
      .where(inArray(users.id, ids));

    if (usersToDelete.length === 0) {
      return NextResponse.json({ error: '未找到要删除的用户' }, { status: 404 });
    }

    // 检查是否包含 admin 用户（admin 用户任何情况下都不可删除）
    const adminUsers = usersToDelete.filter(u => u.username === 'admin');
    if (adminUsers.length > 0) {
      return NextResponse.json({
        error: `系统管理员账户不可删除：${adminUsers.map(u => u.name).join('、')}`,
      }, { status: 400 });
    }

    // 不允许删除自己
    const selfInList = usersToDelete.find(u => u.id === userData.userId);
    if (selfInList) {
      return NextResponse.json({ error: '不能删除当前登录用户' }, { status: 400 });
    }

    // 执行批量删除
    const validIds = usersToDelete.map(u => u.id);
    await db.delete(users).where(inArray(users.id, validIds));

    return NextResponse.json({
      success: true,
      message: `成功删除 ${validIds.length} 名用户`,
      count: validIds.length,
    });
  } catch (error) {
    console.error('批量删除用户失败:', error);
    return NextResponse.json({ error: '批量删除用户失败' }, { status: 500 });
  }
}

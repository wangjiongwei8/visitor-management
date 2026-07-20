import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hostContacts } from '@/lib/schema';
import { inArray } from 'drizzle-orm';
import { parseToken, getUserById } from '@/lib/auth';
import { cookies } from 'next/headers';

// POST - 批量删除受访人
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

    const user = await getUserById(userData.userId);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    const body = await request.json();
    const { ids } = body as { ids: number[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '请提供要删除的ID列表' }, { status: 400 });
    }

    // 批量删除
    await db.delete(hostContacts).where(inArray(hostContacts.id, ids));

    return NextResponse.json({ 
      success: true, 
      count: ids.length,
      message: `成功删除 ${ids.length} 条记录` 
    });
  } catch (error) {
    console.error('Failed to batch delete host contacts:', error);
    return NextResponse.json({ error: '批量删除失败' }, { status: 500 });
  }
}

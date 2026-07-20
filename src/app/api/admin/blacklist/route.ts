import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { blacklist } from '@/storage/database/shared/schema';
import { eq, or, like, and, desc } from 'drizzle-orm';
import { parseToken, getUserById } from '@/lib/auth';
import { cookies } from 'next/headers';

// GET - 获取黑名单列表
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');

    let blacklists;
    if (query) {
      blacklists = await db
        .select()
        .from(blacklist)
        .where(
          or(
            like(blacklist.name, `%${query}%`),
            like(blacklist.idCard, `%${query}%`),
            like(blacklist.phone || '', `%${query}%`)
          )
        )
        .orderBy(desc(blacklist.createdAt));
    } else {
      blacklists = await db
        .select()
        .from(blacklist)
        .orderBy(desc(blacklist.createdAt));
    }

    return NextResponse.json(blacklists);
  } catch (error) {
    console.error('获取黑名单失败:', error);
    return NextResponse.json({ error: '获取黑名单失败' }, { status: 500 });
  }
}

// POST - 添加黑名单
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
    const { name, idCard, phone, reason, isPermanent, expiryDate } = body;

    if (!name || !idCard || !reason) {
      return NextResponse.json({ error: '姓名、身份证号和原因为必填项' }, { status: 400 });
    }

    // 检查是否已存在
    const existing = await db
      .select()
      .from(blacklist)
      .where(eq(blacklist.idCard, idCard));

    if (existing.length > 0) {
      return NextResponse.json({ error: '该身份证号已在黑名单中' }, { status: 400 });
    }

    const newBlacklist = await db
      .insert(blacklist)
      .values({
        name,
        idCard,
        phone: phone || null,
        reason,
        blacklistedBy: user.name,
        isPermanent: isPermanent || false,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      })
      .returning();

    return NextResponse.json(newBlacklist[0], { status: 201 });
  } catch (error) {
    console.error('添加黑名单失败:', error);
    return NextResponse.json({ error: '添加黑名单失败' }, { status: 500 });
  }
}

// DELETE - 删除黑名单
export async function DELETE(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少黑名单ID' }, { status: 400 });
    }

    const deleted = await db
      .delete(blacklist)
      .where(eq(blacklist.id, parseInt(id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: '黑名单记录不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除黑名单失败:', error);
    return NextResponse.json({ error: '删除黑名单失败' }, { status: 500 });
  }
}

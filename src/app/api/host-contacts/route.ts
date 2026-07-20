import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hostContacts } from '@/lib/schema';
import { eq, like, or, desc } from 'drizzle-orm';
import { parseToken, getUserById } from '@/lib/auth';
import { cookies } from 'next/headers';

// 禁用路由缓存 — 受访人/部门数据要求实时性
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - 获取受访人列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');

    let conditions = [];
    if (query) {
      conditions.push(
        or(
          like(hostContacts.name, `%${query}%`),
          like(hostContacts.department, `%${query}%`)
        )
      );
    }

    const results = conditions.length > 0
      ? await db.select().from(hostContacts).where(conditions[0]).orderBy(desc(hostContacts.createdAt))
      : await db.select().from(hostContacts).orderBy(desc(hostContacts.createdAt));

    return NextResponse.json(results);
  } catch (error) {
    console.error('获取受访人列表失败:', error);
    return NextResponse.json({ error: '获取受访人列表失败' }, { status: 500 });
  }
}

// POST - 添加受访人
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userData = parseToken(token);
    if (!userData) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const body = await request.json();
    const { name, department, phone, email, position } = body;

    if (!name || !department) {
      return NextResponse.json({ error: '姓名和部门不能为空' }, { status: 400 });
    }

    const newContact = await db.insert(hostContacts).values({
      name,
      department,
      phone,
      email,
      position,
      createdBy: userData.username,
    }).returning();

    return NextResponse.json(newContact[0], { status: 201 });
  } catch (error) {
    console.error('添加受访人失败:', error);
    return NextResponse.json({ error: '添加受访人失败' }, { status: 500 });
  }
}
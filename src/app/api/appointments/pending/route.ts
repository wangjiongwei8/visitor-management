import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appointments } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { parseToken } from '@/lib/auth';

// 禁用路由缓存 — 待审批预约数据要求实时性
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - 获取待审批预约列表（按受访人筛选）
export async function GET(request: NextRequest) {
  try {
    // 验证登录
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    const userData = parseToken(token);
    if (!userData) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    // 查询待审批的预约
    // 员工只能看到以自己为受访人的待审批预约
    // 管理员可以看到所有待审批预约
    let pendingList;

    if (userData.role === 'admin') {
      // 管理员看全部
      pendingList = await db
        .select()
        .from(appointments)
        .where(eq(appointments.status, 'pending'))
        .orderBy(appointments.createdAt);
    } else {
      // 员工只看自己的受访预约
      pendingList = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.status, 'pending'),
            eq(appointments.visitObject, userData.name)
          )
        )
        .orderBy(appointments.createdAt);
    }

    return NextResponse.json(pendingList || []);
  } catch (error) {
    console.error('获取待审批列表失败:', error);
    return NextResponse.json([], { status: 200 });
  }
}

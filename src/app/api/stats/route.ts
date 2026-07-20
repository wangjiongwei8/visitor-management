import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appointments, visitRecords } from '@/lib/schema';
import { eq, and, sql, count } from 'drizzle-orm';
import { parseToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// 禁用路由缓存 — 首页统计数据要求实时性
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - 获取首页统计数据
export async function GET() {
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

    // 今日预约数（预约日期=今天，排除已取消的）
    const todayAppointmentsResult = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          sql`(appointment_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date`,
          sql`status NOT IN ('cancelled')`
        )
      );
    const todayAppointments = todayAppointmentsResult[0]?.count || 0;

    // 今日访客数 = 今日签到记录数（与签退/未签退统一维度）
    const todayVisitorsResult = await db
      .select({ count: count() })
      .from(visitRecords)
      .where(
        and(
          sql`(check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date`,
          sql`check_in_time IS NOT NULL`
        )
      );
    const todayVisitors = todayVisitorsResult[0]?.count || 0;

    // 今日签退数（按签退日期统计，支持跨天签退）
    const todayCheckOutsResult = await db
      .select({ count: count() })
      .from(visitRecords)
      .where(
        and(
          sql`(check_out_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date`,
          sql`check_out_time IS NOT NULL`
        )
      );
    const todayCheckOuts = todayCheckOutsResult[0]?.count || 0;

    // 今日未签退 = 今日签到且尚未签退的记录数
    const todayNotCheckedOutResult = await db
      .select({ count: count() })
      .from(visitRecords)
      .where(
        and(
          sql`(check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date`,
          sql`check_in_time IS NOT NULL`,
          sql`check_out_time IS NULL`
        )
      );
    const todayNotCheckedOut = todayNotCheckedOutResult[0]?.count || 0;

    return NextResponse.json({
      todayVisitors,
      todayCheckOuts,
      todayAppointments,
      todayNotCheckedOut,
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return NextResponse.json({ error: '获取统计数据失败' }, { status: 500 });
  }
}

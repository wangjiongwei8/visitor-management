import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appointments, visitRecords } from '@/lib/schema';
import { eq, and, gte, lte, sql, count, isNotNull, isNull } from 'drizzle-orm';
import { parseToken } from '@/lib/auth';

// 禁用路由缓存 — 访客看板数据要求实时性
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 将 UTC 存储的 Date 对象转为上海时区 YYYY-MM-DD 字符串
const fmtDateFromUTC = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  if (typeof d === 'string') return d.substring(0, 10);
  const shanghaiOffset = 8 * 60;
  const shanghaiTime = new Date(d.getTime() + shanghaiOffset * 60 * 1000);
  return `${shanghaiTime.getUTCFullYear()}-${String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0')}-${String(shanghaiTime.getUTCDate()).padStart(2, '0')}`;
};

// ==================== 速率限制 ====================
const boardAccessAttempts = new Map<string, { count: number; resetAt: number }>();
const BOARD_RATE_LIMIT = 60; // 每IP每分钟最多60次请求
const BOARD_WINDOW_MS = 60 * 1000;

function checkBoardRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = boardAccessAttempts.get(ip);
  if (!record || now > record.resetAt) {
    boardAccessAttempts.set(ip, { count: 1, resetAt: now + BOARD_WINDOW_MS });
    return true;
  }
  if (record.count >= BOARD_RATE_LIMIT) return false;
  record.count++;
  return true;
}

// 获取时间范围
function getTimeRange(range: string): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (range) {
    case 'today': {
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      return { start: today, end };
    }
    case 'tomorrow': {
      const start = new Date(today);
      start.setDate(start.getDate() + 1);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'this_week': {
      const start = new Date(today);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'next_week': {
      const start = new Date(today);
      start.setDate(start.getDate() - start.getDay() + 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'next_month': {
      const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
      return { start, end };
    }
    default:
      return { start: new Date(2020, 0, 1), end: new Date(2030, 11, 31) };
  }
}

// 访客分类配置
const VISITOR_CATEGORIES: Record<string, string> = {
  business: '业务类',
  affairs: '事务类',
  special: '特殊类',
};

// GET - 获取访客看板数据
export async function GET(request: NextRequest) {
  try {
    // IP 速率限制
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    if (!checkBoardRateLimit(clientIp)) {
      return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'all';
    const purpose = searchParams.get('purpose') || '';
    const receiver = searchParams.get('receiver') || '';

    const { start, end } = getTimeRange(range);
    const now = new Date();
    // 容器时区为 UTC，需手动 +8h 得到上海时区日期
    const shanghaiOffset = 8 * 60;
    const shanghaiNow = new Date(now.getTime() + shanghaiOffset * 60 * 1000);
    const todayStart = new Date(shanghaiNow.getUTCFullYear(), shanghaiNow.getUTCMonth(), shanghaiNow.getUTCDate());

    // 构建查询条件
    const conditions = [
      gte(appointments.appointmentDate, start),
      lte(appointments.appointmentDate, end),
    ];
    if (purpose) conditions.push(eq(appointments.visitPurpose, purpose));
    if (receiver) conditions.push(eq(appointments.visitObject, receiver));

    // 并行执行所有查询（优化：一次性获取所有需要的数据）
    const [
      appointmentList,
      allCheckInRecords,
      allAppointments,
    ] = await Promise.all([
      // 筛选范围内的预约
      db.select().from(appointments).where(and(...conditions)).orderBy(appointments.appointmentDate),
      // 所有签到记录（用于计算签到状态）
      db.select().from(visitRecords).where(isNotNull(visitRecords.checkInTime)),
      // 所有预约（用于趋势计算和筛选器）
      db.select().from(appointments),
    ]);

    // 构建签到状态映射
    const checkInMap = new Map<number, { checkInTime: Date | null; checkOutTime: Date | null }>();
    allCheckInRecords.forEach(r => {
      if (r.appointmentId) {
        checkInMap.set(r.appointmentId, {
          checkInTime: r.checkInTime,
          checkOutTime: r.checkOutTime,
        });
      }
    });

    // 统计数据（内存计算）
    const totalVisitors = appointmentList.length;
    let pendingVisitors = 0;  // 待签到 = 已预约未签到
    const purposeStats: Record<string, number> = {};
    const categoryStats: Record<string, number> = { '业务类': 0, '事务类': 0, '特殊类': 0 };
    // 简化状态统计：去掉"待审批"，因为现在预约创建后直接是"录入通过"
    const statusStats: Record<string, number> = { '录入通过': 0, '已签到': 0, '已签退': 0, '已取消': 0 };

    let todayAppointments = 0;
    let todayCheckIns = 0;
    let inFactoryCount = 0;

    appointmentList.forEach(a => {
      const checkInfo = checkInMap.get(a.id);
      const hasCheckedIn = !!checkInfo?.checkInTime;
      const hasCheckedOut = !!checkInfo?.checkOutTime;

      // 待签到：已预约但还未签到
      if (!hasCheckedIn && a.status !== 'cancelled') {
        pendingVisitors++;
      }

      // 来访目的统计
      const p = a.visitPurpose || '其他';
      purposeStats[p] = (purposeStats[p] || 0) + 1;

      // 访客类型统计
      const cat = VISITOR_CATEGORIES[a.visitorCategory || 'business'] || '业务类';
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;

      // 状态统计（简化流程：录入通过 → 签到 → 签退）
      if (hasCheckedOut) statusStats['已签退']++;
      else if (hasCheckedIn) statusStats['已签到']++;
      else if (a.status === 'cancelled') statusStats['已取消']++;
      else statusStats['录入通过']++;  // 默认状态，无需审批

      // 今日数据
      if (a.appointmentDate >= todayStart && a.appointmentDate < new Date(todayStart.getTime() + 86400000)) {
        todayAppointments++;
      }
    });

    // 今日签到和在厂访客（从签到记录计算）
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    allCheckInRecords.forEach(r => {
      if (r.checkInTime) {
        const checkInDate = new Date(r.checkInTime);
        if (checkInDate >= todayStart && checkInDate <= todayEnd) {
          todayCheckIns++;
        }
      }
      // 在厂访客：已签到未签退
      if (r.checkInTime && !r.checkOutTime) {
        inFactoryCount++;
      }
    });

    // 来访趋势（最近5个月，使用已有的allAppointments数据）
    const trendData: { month: string; count: number }[] = [];
    for (let i = 4; i >= 0; i--) {
      const monthDate = new Date(shanghaiNow.getUTCFullYear(), shanghaiNow.getUTCMonth() - i, 1);
      const monthStart = monthDate;
      const monthEnd = new Date(shanghaiNow.getUTCFullYear(), shanghaiNow.getUTCMonth() - i + 1, 0, 23, 59, 59, 999);

      const count = allAppointments.filter(a =>
        a.appointmentDate >= monthStart && a.appointmentDate <= monthEnd
      ).length;

      const monthStr = `${monthDate.getFullYear()}年${String(monthDate.getMonth() + 1).padStart(2, '0')}月`;
      trendData.push({ month: monthStr, count });
    }

    // 筛选器（使用已有的allAppointments数据）
    const purposes = [...new Set(allAppointments.map(a => a.visitPurpose).filter(Boolean))];
    const receivers = [...new Set(allAppointments.map(a => a.visitObject).filter(Boolean))];

    // 预约列表（手机号脱敏：只显示前3后4位）
    const appointmentsResult = appointmentList.map(a => {
      const checkInfo = checkInMap.get(a.id);
      const maskedPhone = a.visitorPhone 
        ? a.visitorPhone.substring(0, 3) + '****' + a.visitorPhone.substring(a.visitorPhone.length - 4)
        : '';
      return {
        id: a.id,
        visitorName: a.visitorName,
        visitorPhone: maskedPhone,
        company: a.company,
        visitorType: a.visitorType,
        visitorCategory: a.visitorCategory,
        visitPurpose: a.visitPurpose,
        visitObject: a.visitObject,
        appointmentDate: fmtDateFromUTC(a.appointmentDate),
        appointmentTime: a.appointmentTime,
        status: a.status,
        hasCheckedIn: !!checkInfo?.checkInTime,
        hasCheckedOut: !!checkInfo?.checkOutTime,
      };
    });

    return NextResponse.json({
      totalVisitors,
      pendingVisitors,
      purposeStats,
      categoryStats,
      statusStats,
      todayData: {
        appointments: todayAppointments,
        checkIns: todayCheckIns,
        inFactory: inFactoryCount,
      },
      trendData,
      filters: { purposes, receivers },
      appointments: appointmentsResult,
    });
  } catch (error) {
    console.error('Failed to fetch visitor board data:', error);
    return NextResponse.json({ error: '获取看板数据失败' }, { status: 500 });
  }
}

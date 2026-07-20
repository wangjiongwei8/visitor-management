import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { visitRecords, appointments, VISITOR_TYPE_CONFIG } from '@/storage/database/shared/schema';
import { isNotNull, isNull, eq, and, inArray, like, or } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';

// 禁用路由缓存 — 在厂访客数据要求实时性
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

// 脱敏工具函数
const maskName = (name: string | null | undefined): string => {
  if (!name || name.length <= 1) return name || '';
  return name[0] + '*'.repeat(name.length - 1);
};

const maskPhone = (phone: string | null | undefined): string => {
  if (!phone || phone.length !== 11) return phone || '';
  return phone.substring(0, 3) + '****' + phone.substring(7);
};

const maskIdCard = (idCard: string | null | undefined): string => {
  if (!idCard || idCard.length < 8) return idCard || '';
  return idCard.substring(0, 4) + '****' + idCard.substring(idCard.length - 4);
};

// GET - 获取当前在厂访客列表（已签到未签退，不限签到日期，支持跨天签退场景）
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request, ['admin', 'security']);
    if (authResult instanceof NextResponse) return authResult;

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';

    // 查询所有已签到且未签退的访客记录（不限签到日期）
    let records;
    if (q.trim()) {
      // 有关键词搜索
      const searchStr = `%${q.trim()}%`;
      records = await db
        .select()
        .from(visitRecords)
        .where(and(
          isNotNull(visitRecords.checkInTime),
          isNull(visitRecords.checkOutTime),
          or(
            like(visitRecords.visitorName, searchStr),
            like(visitRecords.visitorPhone, searchStr),
            like(visitRecords.visitorIdCard, searchStr),
          ),
        ))
        .orderBy(visitRecords.checkInTime);
    } else {
      // 获取所有在厂访客
      records = await db
        .select()
        .from(visitRecords)
        .where(and(
          isNotNull(visitRecords.checkInTime),
          isNull(visitRecords.checkOutTime),
        ))
        .orderBy(visitRecords.checkInTime);
    }

    // 获取关联的预约信息
    const appointmentIds = records.map(r => r.appointmentId).filter(Boolean) as number[];
    let appointmentsData: any[] = [];
    if (appointmentIds.length > 0) {
      appointmentsData = await db
        .select()
        .from(appointments)
        .where(inArray(appointments.id, appointmentIds));
    }
    const appointmentsMap = new Map(appointmentsData.map(a => [a.id, a]));

    // 组合数据
    const results = records.map(r => {
      const appointment = r.appointmentId ? appointmentsMap.get(r.appointmentId) : null;
      return {
        id: r.id,
        visitorCode: appointment?.visitorCode || null,
        name: maskName(r.visitorName),
        idCard: maskIdCard(r.visitorIdCard || ''),
        phone: maskPhone(r.visitorPhone),
        company: appointment?.company || '',
        visitObject: r.visitObject,
        visitPurpose: r.visitPurpose,
        visitDate: fmtDateFromUTC(appointment?.appointmentDate || r.checkInTime),
        appointmentTime: appointment?.appointmentTime,
        needMeal: appointment?.needMeal || false,
        visitorType: r.visitorType,
        totalVisitors: appointment?.visitorCount || 1,
        vehicleInfo: [], // TODO: 从车辆表查询
        entourageInfo: [], // TODO: 从随行人员表查询
        checkInTime: r.checkInTime,
        passColor: r.passColor,
        passNumber: r.passNumber,
      };
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('获取今日访客列表失败:', error);
    return NextResponse.json({ error: '获取访客列表失败' }, { status: 500 });
  }
}

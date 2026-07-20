import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appointments, visitRecords } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';

// 禁用路由缓存 — 门卫预约查询数据要求实时性
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 格式化日期为 YYYY-MM-DD 字符串（避免 UTC 时区问题）
const fmtDate = (d: Date | null) => {
  if (!d) return '';
  // Date 对象存储为 UTC（d-1 16:00），需按上海时区读取日期
  const shanghaiOffset = 8 * 60;
  const shanghaiTime = new Date(d.getTime() + shanghaiOffset * 60 * 1000);
  return `${shanghaiTime.getUTCFullYear()}-${String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0')}-${String(shanghaiTime.getUTCDate()).padStart(2, '0')}`;
};

// GET - 获取门卫预约列表（支持日期查询）
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request, ['admin', 'security']);
    if (authResult instanceof NextResponse) return authResult;

    const searchParams = request.nextUrl.searchParams;
    // 支持指定日期查询，默认当天
    const dateParam = searchParams.get('date');
    const dateCondition = dateParam
      ? sql`(appointment_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date = ${dateParam}::date`
      : sql`(appointment_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date`;

    // 查询指定日期的预约
    const todayAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          dateCondition,
          // 排除已取消和已拒绝的预约
          sql`status NOT IN ('rejected', 'cancelled')`
        )
      );

    // 获取所有预约ID
    const appointmentIds = todayAppointments.map(a => a.id);

    // 查询对应的签到记录
    const records = appointmentIds.length > 0
      ? await db
          .select()
          .from(visitRecords)
          .where(
            sql`${visitRecords.appointmentId} IN (${sql.join(
              appointmentIds.map(id => sql`${id}`),
              sql`, `
            )})`
          )
      : [];

    // 合并数据并脱敏处理
    const result = todayAppointments.map(appointment => {
      const record = records.find(r => r.appointmentId === appointment.id);

      return {
        id: appointment.id,
        visitorCode: appointment.visitorCode,
        visitorName: appointment.visitorName,
        // 电话脱敏：138****8000
        visitorPhone: maskPhone(appointment.visitorPhone),
        visitorPhoneRaw: appointment.visitorPhone,
        visitorCount: appointment.visitorCount,
        visitorType: appointment.visitorType,
        visitorCategory: appointment.visitorCategory,
        company: appointment.company,
        visitObject: appointment.visitObject,
        visitPurpose: appointment.visitPurpose,
        appointmentDate: fmtDate(appointment.appointmentDate),
        appointmentTime: appointment.appointmentTime,
        needMeal: appointment.needMeal,
        status: appointment.status,
        applicantId: appointment.applicantId,
        applicantName: appointment.applicantName,
        // 签到信息
        hasCheckedIn: !!record?.checkInTime,
        checkInTime: record?.checkInTime?.toISOString() || null,
        hasCheckedOut: !!record?.checkOutTime,
        checkOutTime: record?.checkOutTime?.toISOString() || null,
        visitStatus: record?.visitStatus || null,
      };
    });

    // 按预约时间排序
    result.sort((a, b) => {
      if (a.appointmentTime < b.appointmentTime) return -1;
      if (a.appointmentTime > b.appointmentTime) return 1;
      return 0;
    });

    return NextResponse.json({
      success: true,
      data: result,
      total: result.length,
    });
  } catch (error) {
    console.error('获取预约列表失败:', error);
    return NextResponse.json({
      success: true,
      data: [],
      total: 0,
    });
  }
}

// 电话号码脱敏函数
function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

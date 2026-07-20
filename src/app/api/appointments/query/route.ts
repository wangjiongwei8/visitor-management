import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appointments, visitRecords } from '@/lib/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';
import { getAppointmentVehicleSummaries } from '@/lib/appointment-vehicles';

// 禁用路由缓存 — 预约查询数据要求实时性
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - 预约方查询自己的预约
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request, ['admin', 'employee']);
    if (authResult instanceof NextResponse) return authResult;

    const searchParams = request.nextUrl.searchParams;
    const applicantId = searchParams.get('applicantId');
    const status = searchParams.get('status');
    const query = searchParams.get('query');

    if (!applicantId) {
      return NextResponse.json({ error: '缺少申请人ID' }, { status: 400 });
    }

    // 构建查询条件
    const conditions = [eq(appointments.applicantId, applicantId)];

    // 获取所有预约
    const results = await db
      .select()
      .from(appointments)
      .where(and(...conditions))
      .orderBy(desc(appointments.createdAt));

    // 获取签到记录
    const appointmentIds = results.map(a => a.id);
    let visitRecordsList: any[] = [];

    if (appointmentIds.length > 0) {
      try {
        visitRecordsList = await db
          .select()
          .from(visitRecords)
          .where(inArray(visitRecords.appointmentId, appointmentIds));
      } catch (err) {
        console.error('查询签到记录失败:', err);
        visitRecordsList = [];
      }
    }

    // 使用兼容助手获取车辆/随访人员（避免老库 follower_* 列不存在导致崩溃）
    const vehicleSummaryMap = await getAppointmentVehicleSummaries(
      results.map(appointment => ({ id: appointment.id, visitorId: appointment.visitorId })),
    );

    // 为每个预约添加签到/签退状态 + 车辆和随访人员信息
    let appointmentsWithStatus = results.map(appointment => {
      const visitRecord = visitRecordsList.find(r => r.appointmentId === appointment.id);
      const vehicleSummary = vehicleSummaryMap.get(appointment.id);

      return {
        ...appointment,
        hasCheckedIn: !!visitRecord?.checkInTime,
        hasCheckedOut: !!visitRecord?.checkOutTime,
        // 车辆信息
        licensePlate: vehicleSummary?.licensePlate || '',
        vehicleInfo: vehicleSummary?.vehicleInfo || [],
        // 随访人员列表
        followers: vehicleSummary?.followers || [],
      };
    });

    // 根据状态筛选
    if (status && status !== 'all') {
      if (status === 'checked_in') {
        appointmentsWithStatus = appointmentsWithStatus.filter(a => a.hasCheckedIn && !a.hasCheckedOut);
      } else if (status === 'checked_out') {
        appointmentsWithStatus = appointmentsWithStatus.filter(a => a.hasCheckedOut);
      }
    }

    // 关键词搜索
    if (query) {
      appointmentsWithStatus = appointmentsWithStatus.filter(a =>
        a.visitorName.includes(query) ||
        (a.company && a.company.includes(query)) ||
        a.visitObject.includes(query) ||
        (a.visitorCode && a.visitorCode.includes(query))
      );
    }

    return NextResponse.json(appointmentsWithStatus);
  } catch (error) {
    console.error('查询预约失败:', error);
    return NextResponse.json({ error: '查询预约失败' }, { status: 500 });
  }
}

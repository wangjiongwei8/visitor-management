import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appointments, visitRecords } from "@/lib/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { parseToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { getAppointmentVehicleSummaries } from "@/lib/appointment-vehicles";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userData = parseToken(token);
    if (!userData) {
      return NextResponse.json({ error: "登录已过期" }, { status: 401 });
    }

    // 员工、管理员都只看自己创建的预约（门卫通过 /api/visitors/management-query 查全部）
    const results = await db
      .select()
      .from(appointments)
      .where(eq(appointments.applicantId, userData.username))
      .orderBy(desc(appointments.createdAt));

    const appointmentIds = results.map(a => a.id);
    let visitRecordsList: any[] = [];

    if (appointmentIds.length > 0) {
      visitRecordsList = await db
        .select()
        .from(visitRecords)
        .where(inArray(visitRecords.appointmentId, appointmentIds));
    }

    const visitRecordMap = new Map(visitRecordsList.map(r => [r.appointmentId, r]));
    const vehicleSummaryMap = await getAppointmentVehicleSummaries(
      results.map(appointment => ({ id: appointment.id, visitorId: appointment.visitorId })),
    );

    const appointmentsWithStatus = results.map(appointment => {
      const visitRecord = visitRecordMap.get(appointment.id);
      const vehicleSummary = vehicleSummaryMap.get(appointment.id);

      const fmtDate = (d: Date | string | null) => {
        if (!d) return '';
        if (typeof d === 'string') return d.substring(0, 10);
        // Date 对象存储为 UTC（d-1 16:00），需按上海时区读取日期
        const shanghaiOffset = 8 * 60; // UTC+8 分钟
        const shanghaiTime = new Date(d.getTime() + shanghaiOffset * 60 * 1000);
        return `${shanghaiTime.getUTCFullYear()}-${String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0')}-${String(shanghaiTime.getUTCDate()).padStart(2, '0')}`;
      };
      return {
        ...appointment,
        appointmentDate: fmtDate(appointment.appointmentDate as any),
        hasCheckedIn: !!visitRecord?.checkInTime,
        checkInTime: visitRecord?.checkInTime || null,
        hasCheckedOut: !!visitRecord?.checkOutTime,
        checkOutTime: visitRecord?.checkOutTime || null,
        // 车辆信息
        licensePlate: vehicleSummary?.licensePlate || '',
        vehicleInfo: vehicleSummary?.vehicleInfo || [],
        // 随访人员
        followers: vehicleSummary?.followers || [],
      };
    });

    return NextResponse.json(appointmentsWithStatus);
  } catch (error) {
    console.error("获取我的预约失败:", error);
    return NextResponse.json({ error: "获取预约列表失败" }, { status: 500 });
  }
}

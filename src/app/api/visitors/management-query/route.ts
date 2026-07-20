import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appointments, visitRecords, longTermVehicles } from '@/storage/database/shared/schema';
import { and, sql, count, isNull, isNotNull, inArray } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';
import { getAppointmentVehicleSummaries } from '@/lib/appointment-vehicles';

// 禁用路由缓存 — 访客管理查询数据要求实时性
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

// 将 UTC 存储的 Date 对象转为上海时区 YYYY-MM-DD HH:mm 字符串
const fmtDateTimeFromUTC = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  if (typeof d === 'string') return d.substring(0, 16).replace('T', ' ');
  const shanghaiOffset = 8 * 60;
  const shanghaiTime = new Date(d.getTime() + shanghaiOffset * 60 * 1000);
  return `${shanghaiTime.getUTCFullYear()}-${String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0')}-${String(shanghaiTime.getUTCDate()).padStart(2, '0')} ${String(shanghaiTime.getUTCHours()).padStart(2, '0')}:${String(shanghaiTime.getUTCMinutes()).padStart(2, '0')}`;
};

// GET - 管理员查询所有访客（从appointments表）
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request, ['admin', 'security']);
    if (authResult instanceof NextResponse) return authResult;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const visitorType = searchParams.get('visitorType');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const visitObject = searchParams.get('visitObject');
    const company = searchParams.get('company');
    const query = searchParams.get('query');

    // 获取今日日期（容器时区为 UTC，需手动 +8h 得到上海时区日期）
    const now = new Date();
    const shanghaiOffset = 8 * 60;
    const shanghaiNow = new Date(now.getTime() + shanghaiOffset * 60 * 1000);
    const todayStr = `${shanghaiNow.getUTCFullYear()}-${String(shanghaiNow.getUTCMonth() + 1).padStart(2, '0')}-${String(shanghaiNow.getUTCDate()).padStart(2, '0')}`;

    const isSecurity = authResult.role === 'security';

    // 获取所有预约和对应的签到记录、车辆信息
    // 门卫只能查看近2周及未来的预约
    const allAppointments = isSecurity
      ? await db
          .select()
          .from(appointments)
          .where(
            sql`(appointment_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date >= (NOW() AT TIME ZONE 'Asia/Shanghai')::date - INTERVAL '14 days'`
          )
          .orderBy(appointments.createdAt)
      : await db.select().from(appointments);
    const appointmentIds = allAppointments.map(a => a.id);

    let visitRecordsList: any[] = [];
    if (appointmentIds.length > 0) {
      visitRecordsList = await db
        .select()
        .from(visitRecords)
        .where(inArray(visitRecords.appointmentId, appointmentIds));
    }

    // 构建签到状态映射
    const visitMap = new Map<number, { checkInTime: Date | null; checkOutTime: Date | null }>();
    visitRecordsList.forEach(r => {
      if (r.appointmentId) {
        visitMap.set(r.appointmentId, {
          checkInTime: r.checkInTime,
          checkOutTime: r.checkOutTime,
        });
      }
    });

    // ====== 长约车辆签到记录 ======
    // 查询所有长约签到记录（longTermVehicleId 不为空）
    let longTermVisitRecords: any[] = [];
    let longTermVehicleMap = new Map<number, any>();
    if (!isSecurity) {
      // 管理员：拉全量长约签到记录
      longTermVisitRecords = await db
        .select()
        .from(visitRecords)
        .where(isNotNull(visitRecords.longTermVehicleId))
        .orderBy(visitRecords.checkInTime);
    } else {
      // 门卫：只拉近2周的长约签到记录
      longTermVisitRecords = await db
        .select()
        .from(visitRecords)
        .where(
          and(
            isNotNull(visitRecords.longTermVehicleId),
            sql`(check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date >= (NOW() AT TIME ZONE 'Asia/Shanghai')::date - INTERVAL '14 days'`
          )
        )
        .orderBy(visitRecords.checkInTime);
    }

    // 查询关联的长约车辆信息
    if (longTermVisitRecords.length > 0) {
      const longTermIds = [...new Set(longTermVisitRecords.map(r => r.longTermVehicleId).filter(Boolean))] as number[];
      if (longTermIds.length > 0) {
        const longTermRows = await db
          .select()
          .from(longTermVehicles)
          .where(inArray(longTermVehicles.id, longTermIds));
        longTermRows.forEach(lt => longTermVehicleMap.set(lt.id, lt));
      }
    }

    // 长约签到记录也纳入在厂统计
    const allActiveVisitRecords = [
      ...visitRecordsList.filter(r => r.checkInTime && !r.checkOutTime),
      ...longTermVisitRecords.filter(r => r.checkInTime && !r.checkOutTime),
    ];

    const vehicleSummaryMap = await getAppointmentVehicleSummaries(
      allAppointments.map(appointment => ({ id: appointment.id, visitorId: appointment.visitorId })),
    );

    // 计算统计数据 - 使用显式 (NOW() AT TIME ZONE 'Asia/Shanghai')::date，避免容器 UTC 时区导致 CURRENT_DATE 错误
    // 只排除已取消的预约，已拒绝的也是预约应统计
    const todayResult = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        sql`(appointment_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date AND status <> 'cancelled'`
      );
    const todayAppointments = todayResult[0]?.count || 0;

    // 今日签到：签到时间（北京时区）= 今天
    const checkedInResult = await db
      .select({ count: count() })
      .from(visitRecords)
      .where(sql`(check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date`);
    const todayCheckedIn = checkedInResult[0]?.count || 0;

    // 今日签退：签退时间（北京时区）= 今天
    const checkedOutResult = await db
      .select({ count: count() })
      .from(visitRecords)
      .where(
        and(
          sql`(check_out_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date`,
          isNotNull(visitRecords.checkOutTime)
        )
      );
    const todayCheckedOut = checkedOutResult[0]?.count || 0;

    // 未签退：所有已签到未签退的记录（不限日期）
    const notCheckedOutResult = await db
      .select({ count: count() })
      .from(visitRecords)
      .where(and(isNotNull(visitRecords.checkInTime), isNull(visitRecords.checkOutTime)));
    const todayNotCheckedOut = notCheckedOutResult[0]?.count || 0;

    // 获取在厂访客的车辆数（含预约和长约）
    const activeAppointmentIds = allActiveVisitRecords
      .filter(r => r.appointmentId)
      .map(r => r.appointmentId) as number[];
    const todayVehicles = activeAppointmentIds.reduce(
      (total, appointmentId) => total + (vehicleSummaryMap.get(appointmentId)?.vehicleInfo.length || 0),
      0,
    );
    // 加上在厂长约车的车辆数
    const activeLongTermIds = allActiveVisitRecords
      .filter(r => r.longTermVehicleId)
      .map(r => r.longTermVehicleId);
    const activeLongTermVehicles = activeLongTermIds.filter((id, idx, arr) => arr.indexOf(id) === idx).length;
    const totalVehicles = todayVehicles + activeLongTermVehicles;

    // 构建访客列表（转换appointments为visitors格式）
    let visitorsList = allAppointments.map(apt => {
      const visitInfo = visitMap.get(apt.id);
      const hasCheckedIn = !!visitInfo?.checkInTime;
      const hasCheckedOut = !!visitInfo?.checkOutTime;

      // 状态映射：优先用签到签退状态，否则保留预约自身状态
      let visitorStatus: string;
      if (hasCheckedOut) visitorStatus = 'checked_out';
      else if (hasCheckedIn) visitorStatus = 'checked_in';
      else visitorStatus = apt.status || 'pending';

      const vehicleSummary = vehicleSummaryMap.get(apt.id);

      return {
        id: apt.id,
        name: apt.visitorName,
        phone: apt.visitorPhone,
        company: apt.company,
        visitObject: apt.visitObject,
        visitObjectPhone: apt.visitObjectPhone || '',
        visitPurpose: apt.visitPurpose,
        visitDate: fmtDateFromUTC(apt.appointmentDate),
        appointmentTime: apt.appointmentTime || '',
        visitorType: apt.visitorType,
        visitorCategory: apt.visitorCategory,
        visitorCode: apt.visitorCode,
        status: visitorStatus,
        totalVisitors: apt.visitorCount || 1,
        createdAt: apt.createdAt ? fmtDateTimeFromUTC(apt.createdAt) : '',
        checkInTime: visitInfo?.checkInTime ? fmtDateTimeFromUTC(visitInfo.checkInTime) : '',
        checkOutTime: visitInfo?.checkOutTime ? fmtDateTimeFromUTC(visitInfo.checkOutTime) : '',
        hasCheckedIn,
        hasCheckedOut,
        isLongTerm: false,
        // 车辆信息
        licensePlate: vehicleSummary?.licensePlate || '',
        vehicleInfo: vehicleSummary?.vehicleInfo || [],
        // 随访人员列表
        followers: vehicleSummary?.followers || [],
      };
    });

    // 构建长约访客列表（转换长约签到记录为visitors格式）
    const longTermVisitors = longTermVisitRecords.map(vr => {
      const lt = longTermVehicleMap.get(vr.longTermVehicleId);
      const hasCheckedOut = !!vr.checkOutTime;
      const visitorStatus = hasCheckedOut ? 'checked_out' : 'checked_in';
      const visitorName = lt?.entryType === 'vehicle'
        ? (lt?.driverName || lt?.personName || '长约车辆')
        : (lt?.personName || lt?.driverName || '长约人员');
      const visitorPhone = lt?.personPhone || lt?.driverPhone || '';

      return {
        id: -vr.id, // 负ID避免与预约ID冲突
        name: visitorName,
        phone: visitorPhone,
        company: lt?.company || '',
        visitObject: '长约通行',
        visitObjectPhone: '',
        visitPurpose: lt?.entryType === 'vehicle' ? '长约车辆通行' : lt?.entryType === 'person' ? '长约人员通行' : '长约人车通行',
        visitDate: vr.checkInTime ? fmtDateFromUTC(vr.checkInTime) : '',
        appointmentTime: '',
        visitorType: lt?.visitorType || 'supplier',
        visitorCategory: 'business',
        visitorCode: lt?.longTermCode || '',
        status: visitorStatus,
        totalVisitors: 1,
        createdAt: vr.checkInTime ? fmtDateTimeFromUTC(vr.checkInTime) : '',
        checkInTime: vr.checkInTime ? fmtDateTimeFromUTC(vr.checkInTime) : '',
        checkOutTime: vr.checkOutTime ? fmtDateTimeFromUTC(vr.checkOutTime) : '',
        hasCheckedIn: true,
        hasCheckedOut,
        isLongTerm: true,
        longTermEntryType: lt?.entryType || 'vehicle',
        // 车辆信息
        licensePlate: lt?.licensePlate || '',
        vehicleInfo: lt?.licensePlate ? [{ licensePlate: lt.licensePlate, vehicleModel: lt.vehicleModel || '', vehicleType: '' }] : [],
        // 随访人员列表
        followers: [],
      };
    });

    // 合并预约记录和长约记录
    visitorsList = [...visitorsList, ...longTermVisitors];

    // 过滤
    if (status && status !== 'all') {
      if (status === 'active') {
        // 活跃预约：排除已取消和已拒绝的，其余都显示
        visitorsList = visitorsList.filter(v =>
          !['cancelled', 'rejected'].includes(v.status)
        );
      } else {
        visitorsList = visitorsList.filter(v => v.status === status);
      }
    }

    if (category && category !== 'all') {
      visitorsList = visitorsList.filter(v => v.visitorCategory === category);
    }

    if (visitorType && visitorType !== 'all') {
      visitorsList = visitorsList.filter(v => v.visitorType === visitorType);
    }

    if (dateFrom) {
      visitorsList = visitorsList.filter(v => v.visitDate >= dateFrom);
    }

    if (dateTo) {
      visitorsList = visitorsList.filter(v => v.visitDate <= dateTo);
    }

    if (visitObject) {
      const q = visitObject.toLowerCase();
      visitorsList = visitorsList.filter(v => v.visitObject.toLowerCase().includes(q));
    }

    if (company) {
      const q = company.toLowerCase();
      visitorsList = visitorsList.filter(v => v.company && v.company.toLowerCase().includes(q));
    }

    if (query) {
      const q = query.toLowerCase();
      visitorsList = visitorsList.filter(v =>
        v.name.toLowerCase().includes(q) ||
        (v.company && v.company.toLowerCase().includes(q)) ||
        v.visitObject.toLowerCase().includes(q) ||
        v.phone.includes(query) ||
        (v.visitorCode && v.visitorCode.toLowerCase().includes(q)) ||
        (v.licensePlate && v.licensePlate.toLowerCase().includes(q))
      );
    }

    // 排序：当日优先，然后按状态、来访日期、创建时间
    visitorsList.sort((a, b) => {
      // visitDate 已是 YYYY-MM-DD 字符串，直接与 todayStr 比较
      const aIsToday = a.visitDate === todayStr ? 1 : 0;
      const bIsToday = b.visitDate === todayStr ? 1 : 0;
      if (aIsToday !== bIsToday) return bIsToday - aIsToday;

      const statusOrder: Record<string, number> = { pending: 0, approved: 1, scheduled: 2, checked_in: 3, checked_out: 4, rejected: 5, cancelled: 6 };
      const aStatus = statusOrder[a.status] ?? 4;
      const bStatus = statusOrder[b.status] ?? 4;
      if (aStatus !== bStatus) return aStatus - bStatus;

      // 按来访日期降序，再按创建时间降序
      if (a.visitDate !== b.visitDate) return b.visitDate.localeCompare(a.visitDate);
      return b.createdAt > a.createdAt ? 1 : -1;
    });

    return NextResponse.json({
      visitors: visitorsList,
      stats: {
        todayAppointments,
        todayCheckedIn,
        todayCheckedOut,
        todayVehicles: totalVehicles,
        todayNotCheckedOut,
      },
    });
  } catch (error) {
    console.error('查询访客失败:', error);
    return NextResponse.json({
      visitors: [],
      stats: { todayAppointments: 0, todayCheckedIn: 0, todayCheckedOut: 0, todayVehicles: 0, todayNotCheckedOut: 0 },
    });
  }
}

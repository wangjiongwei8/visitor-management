import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { visitors, visitRecords, appointments, vehicles, longTermVehicles } from '@/storage/database/shared/schema';
import { hostContacts } from '@/lib/schema';
import { or, eq, like, and, isNull, isNotNull, desc, asc, inArray, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';

// 禁用路由缓存 — 门卫签到/签退数据要求实时性，缓存会导致数据不刷新
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

// 共用：将 UTC 存储的 Date 对象转为上海时区 YYYY-MM-DD 字符串
const formatDate = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  if (typeof d === 'string') return d.substring(0, 10);
  const shanghaiOffset = 8 * 60;
  const shanghaiTime = new Date(d.getTime() + shanghaiOffset * 60 * 1000);
  return `${shanghaiTime.getUTCFullYear()}-${String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0')}-${String(shanghaiTime.getUTCDate()).padStart(2, '0')}`;
};

// 安全查询受访人部门信息 — 查询失败时不影响主流程，仅丢失部门字段
async function safeQueryHostDepartments(visitObjects: string[]): Promise<Map<string, string>> {
  const deptMap = new Map<string, string>();
  if (visitObjects.length === 0) return deptMap;
  try {
    const data = await db
      .select({ name: hostContacts.name, department: hostContacts.department })
      .from(hostContacts)
      .where(inArray(hostContacts.name, visitObjects));
    data.forEach(h => { if (h.department) deptMap.set(h.name, h.department); });
  } catch (err) {
    console.error('查询受访人部门失败（不影响主流程）:', err);
  }
  return deptMap;
}

// GET - 搜索访客（支持模糊查询）
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request, ['admin', 'security']);
    if (authResult instanceof NextResponse) return authResult;

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const mode = searchParams.get('mode') || 'checkin'; // checkin 或 checkout

    let results: any[] = [];

    if (mode === 'checkout') {
      // 签退模式：查询已签到未签退的访客记录
      const activeRecords = await db
        .select({
          id: visitRecords.id,
          visitorId: visitRecords.visitorId,
          name: visitRecords.visitorName,
          idCard: visitRecords.visitorIdCard,
          phone: visitRecords.visitorPhone,
          visitObject: visitRecords.visitObject,
          visitPurpose: visitRecords.visitPurpose,
          visitorType: visitRecords.visitorType,
          checkInTime: visitRecords.checkInTime,
          appointmentId: visitRecords.appointmentId,
          passNumber: visitRecords.passNumber,
          passColor: visitRecords.passColor,
          longTermVehicleId: visitRecords.longTermVehicleId,
        })
        .from(visitRecords)
        .where(and(
          isNotNull(visitRecords.checkInTime),
          isNull(visitRecords.checkOutTime)
        ))
        .orderBy(desc(visitRecords.checkInTime));

      // 获取关联的预约信息和长约记录（并行查询）
      const appointmentIds = activeRecords.map(r => r.appointmentId).filter(Boolean) as number[];
      const longTermIds = activeRecords.map(r => r.longTermVehicleId).filter(Boolean) as number[];

      // 并行查询预约、长约、车辆信息（三者互不依赖）
      const [appointmentsData, longTermData, vehiclesData] = await Promise.all([
        appointmentIds.length > 0
          ? db.select().from(appointments).where(inArray(appointments.id, appointmentIds))
          : Promise.resolve([]),
        longTermIds.length > 0
          ? db.select().from(longTermVehicles).where(inArray(longTermVehicles.id, longTermIds))
          : Promise.resolve([]),
        appointmentIds.length > 0
          ? db.select().from(vehicles).where(inArray(vehicles.appointmentId, appointmentIds))
          : Promise.resolve([]),
      ]);

      const appointmentsMap = new Map(appointmentsData.map(a => [a.id, a]));
      const longTermMap = new Map(longTermData.map(l => [l.id, l]));

      const vehiclesMap = new Map<number, any[]>();
      vehiclesData.forEach((v: any) => {
        if (!vehiclesMap.has(v.appointmentId)) {
          vehiclesMap.set(v.appointmentId, []);
        }
        vehiclesMap.get(v.appointmentId)!.push(v);
      });

      // 如果有搜索词，模糊过滤结果
      if (q.trim()) {
        const searchStr = q.trim();
        const isCodeSuffix = /^\d{1,4}$/.test(searchStr);

        results = activeRecords.filter(r => {
          const appointment = r.appointmentId ? appointmentsMap.get(r.appointmentId) : null;
          const longTerm = r.longTermVehicleId ? longTermMap.get(r.longTermVehicleId) : null;

          let codeMatch = false;
          if (appointment?.visitorCode) {
            codeMatch = isCodeSuffix
              ? appointment.visitorCode.endsWith(searchStr)
              : appointment.visitorCode.includes(searchStr);
          }

          let plateMatch = false;
          if (longTerm?.licensePlate) {
            plateMatch = longTerm.licensePlate.includes(searchStr);
          }

          return codeMatch || r.name?.includes(searchStr) || r.phone?.includes(searchStr) || plateMatch;
        });
      } else {
        results = activeRecords;
      }

      // 安全查询受访人部门信息（失败不影响主流程）
      const allVisitObjects = [...new Set(results.map(r => r.visitObject).filter(Boolean))] as string[];
      const hostContactsMap = await safeQueryHostDepartments(allVisitObjects);

      // 组合数据
      results = results.map(r => {
        const appointment = r.appointmentId ? appointmentsMap.get(r.appointmentId) : null;
        const longTerm = r.longTermVehicleId ? longTermMap.get(r.longTermVehicleId) : null;
        const aptVehicles = r.appointmentId ? vehiclesMap.get(r.appointmentId) || [] : [];
        const isLongTerm = !!r.longTermVehicleId;

        return {
          ...r,
          visitorCode: isLongTerm ? (longTerm?.longTermCode || null) : (appointment?.visitorCode || null),
          visitDate: formatDate(appointment?.appointmentDate),
          appointmentTime: appointment?.appointmentTime || null,
          totalVisitors: appointment?.visitorCount || 1,
          company: appointment?.company || (longTerm?.company || ''),
          hostName: r.visitObject,
          hostDepartment: hostContactsMap.get(r.visitObject) || '',
          vehicleInfo: aptVehicles.map(v => ({
            licensePlate: v.licensePlate,
            vehicleModel: v.vehicleModel || '',
            vehicleType: v.vehicleType,
          })),
          licensePlate: aptVehicles.length > 0 ? aptVehicles[0].licensePlate : (longTerm?.licensePlate || undefined),
          isLongTermVehicle: isLongTerm,
          isLongTerm: isLongTerm,
          isOnSite: longTerm?.isOnSite ?? true,
          entryType: longTerm?.entryType || undefined,
          personName: longTerm?.personName || undefined,
          driverName: longTerm?.driverName || undefined,
        };
      });

    } else {
      // 签到模式：查询预约信息 + 长约车
      const allowedStatuses = ['scheduled', 'approved', 'authorized'];
      const todayCondition = sql`(appointment_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date`;

      // 1. 查询普通预约（只查今天预约日期的）
      let appointmentResults: any[] = [];

      if (q.trim()) {
        const searchStr = q.trim();
        const isCodeSuffix = /^\d{1,4}$/.test(searchStr);
        const conditions = [];

        if (isCodeSuffix) {
          conditions.push(like(appointments.visitorCode, `%${searchStr}`));
        }
        conditions.push(like(appointments.visitorName, `%${searchStr}%`));
        conditions.push(like(appointments.visitorPhone, `%${searchStr}%`));
        if (!isCodeSuffix) {
          conditions.push(like(appointments.visitorCode, `%${searchStr}%`));
        }

        appointmentResults = await db
          .select()
          .from(appointments)
          .where(and(
            or(...conditions),
            inArray(appointments.status, allowedStatuses),
            todayCondition
          ))
          .orderBy(asc(appointments.appointmentDate), asc(appointments.appointmentTime))
          .limit(50);
      } else {
        appointmentResults = await db
          .select()
          .from(appointments)
          .where(and(
            inArray(appointments.status, allowedStatuses),
            todayCondition
          ))
          .orderBy(asc(appointments.appointmentDate), asc(appointments.appointmentTime))
          .limit(50);
      }

      // 过滤已签退的预约
      const appointmentIds = appointmentResults.map(a => a.id);
      let checkInRecords: any[] = [];
      if (appointmentIds.length > 0) {
        checkInRecords = await db
          .select()
          .from(visitRecords)
          .where(inArray(visitRecords.appointmentId, appointmentIds));
      }
      const checkInMap = new Map(checkInRecords.map(r => [r.appointmentId, r]));

      appointmentResults = appointmentResults.filter(a => {
        const record = checkInMap.get(a.id);
        if (record && record.checkOutTime) return false;
        return true;
      });

      // 2. 查询长约记录
      let longTermVehicleResults: any[] = [];

      if (q.trim()) {
        const searchStr = q.trim();
        longTermVehicleResults = await db
          .select()
          .from(longTermVehicles)
          .where(and(
            eq(longTermVehicles.status, 'active'),
            sql`${longTermVehicles.validTo} >= NOW()`,
            or(
              like(longTermVehicles.licensePlate, `%${searchStr}%`),
              like(longTermVehicles.driverName, `%${searchStr}%`),
              like(longTermVehicles.driverPhone, `%${searchStr}%`),
              like(longTermVehicles.personName, `%${searchStr}%`),
              like(longTermVehicles.personPhone, `%${searchStr}%`)
            )
          ))
          .limit(20);
      } else {
        longTermVehicleResults = await db
          .select()
          .from(longTermVehicles)
          .where(and(
            eq(longTermVehicles.status, 'active'),
            sql`${longTermVehicles.validTo} >= NOW()`
          ))
          .limit(50);
      }

      // 并行查询：长约签到统计 + 预约车辆信息
      const longTermIds = longTermVehicleResults.map(v => v.id);
      const filteredAppointmentIds = appointmentResults.map(a => a.id);

      const [longTermStats, vehiclesData] = await Promise.all([
        longTermIds.length > 0
          ? db.select({
              longTermVehicleId: visitRecords.longTermVehicleId,
              count: sql`count(*)`.as('count'),
            })
            .from(visitRecords)
            .where(sql`${visitRecords.longTermVehicleId} IN (${sql.join(longTermIds.map(id => sql`${id}`), sql`, `)})`)
            .groupBy(visitRecords.longTermVehicleId)
          : Promise.resolve([]),
        filteredAppointmentIds.length > 0
          ? db.select().from(vehicles).where(inArray(vehicles.appointmentId, filteredAppointmentIds))
          : Promise.resolve([]),
      ]);

      const statsMap = new Map(longTermStats.map(s => [s.longTermVehicleId, s.count]));

      const vehiclesMap = new Map<number, any[]>();
      vehiclesData.forEach((v: any) => {
        if (!vehiclesMap.has(v.appointmentId)) {
          vehiclesMap.set(v.appointmentId, []);
        }
        vehiclesMap.get(v.appointmentId)!.push(v);
      });

      // 合并结果：长约记录转换为预约格式
      const longTermAsAppointments = longTermVehicleResults.map(v => {
        const visitorName = v.entryType === 'person'
          ? (v.personName || '长期访客')
          : (v.driverName || '长期司机');
        const visitObject = v.company || '长期人员';

        const now = new Date();
        const shanghaiOffset = 8 * 60;
        const shanghaiTime = new Date(now.getTime() + shanghaiOffset * 60 * 1000);
        const beijingDate = `${shanghaiTime.getUTCFullYear()}-${String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0')}-${String(shanghaiTime.getUTCDate()).padStart(2, '0')}`;

        return {
          id: -v.id,
          isLongTermVehicle: true,
          visitorCode: v.longTermCode || null,
          name: visitorName,
          phone: v.entryType === 'person' ? (v.personPhone || '') : (v.driverPhone || ''),
          licensePlate: v.entryType === 'vehicle' || v.entryType === 'both' ? v.licensePlate : undefined,
          company: v.company || '',
          visitObject,
          visitPurpose: v.entryType === 'person' ? '长期人员进出' : '长期车辆进出',
          visitDate: beijingDate,
          appointmentTime: '00:00-23:59',
          visitorType: v.visitorType || 'supplier',
          visitorTypeName: v.entryType === 'person' ? '长期访客' : '长约车',
          totalVisitors: 1,
          status: 'scheduled',
          entryType: v.entryType,
          personName: v.personName,
          driverName: v.driverName,
          isLongTerm: true,
          isOnSite: v.isOnSite || false,
          checkinCount: statsMap.get(v.id) || 0,
          vehicleInfo: (v.entryType === 'vehicle' || v.entryType === 'both') ? [{
            licensePlate: v.licensePlate,
            vehicleModel: v.vehicleModel || '未知车型',
            vehicleType: 'car',
          }] : [],
        };
      });

      // 安全查询受访人部门信息（失败不影响主流程）
      const longTermVisitObjects = [...new Set(longTermAsAppointments.map(a => a.visitObject).filter(Boolean))] as string[];
      const appointmentVisitObjects = [...new Set(appointmentResults.map(a => a.visitObject).filter(Boolean))] as string[];
      const allVisitObjects = [...new Set([...longTermVisitObjects, ...appointmentVisitObjects])];
      const hostContactsMap = await safeQueryHostDepartments(allVisitObjects);

      // 转换普通预约字段名
      const convertedAppointments = appointmentResults.map(a => {
        const aptVehicles = vehiclesMap.get(a.id) || [];
        return {
          id: a.id,
          isLongTermVehicle: false,
          visitorCode: a.visitorCode,
          name: a.visitorName,
          phone: a.visitorPhone,
          company: a.company,
          visitObject: a.visitObject,
          hostName: a.visitObject,
          hostDepartment: hostContactsMap.get(a.visitObject) || '',
          visitPurpose: a.visitPurpose,
          visitDate: formatDate(a.appointmentDate),
          appointmentTime: a.appointmentTime,
          visitorType: a.visitorType,
          totalVisitors: a.visitorCount,
          status: a.status,
          vehicleInfo: aptVehicles.map(v => ({
            licensePlate: v.licensePlate,
            vehicleModel: v.vehicleModel || '',
            vehicleType: v.vehicleType,
          })),
          licensePlate: aptVehicles.length > 0 ? aptVehicles[0].licensePlate : undefined,
        };
      });

      // 合并结果
      results = [...longTermAsAppointments.map(a => ({
        ...a,
        hostName: a.visitObject,
        hostDepartment: hostContactsMap.get(a.visitObject) || '',
      })), ...convertedAppointments];
    }

    // 对所有访客信息进行脱敏（长约保留真实信息供门卫核对）
    const maskedResults = results.map(visitor => ({
      ...visitor,
      name: visitor.isLongTerm ? visitor.name : maskName(visitor.name),
      phone: visitor.isLongTerm ? visitor.phone : maskPhone(visitor.phone),
    }));

    return NextResponse.json(maskedResults, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    console.error('搜索访客失败:', error);
    return NextResponse.json({ error: '搜索访客失败' }, { status: 500 });
  }
}

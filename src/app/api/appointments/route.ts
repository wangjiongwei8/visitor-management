import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appointments, vehicles, visitRecords } from '@/lib/schema';
import { VISITOR_TYPE_CONFIG } from '@/lib/schema';
import { eq, and, like } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';
import { checkBlacklist } from '@/lib/blacklist';

// 禁用路由缓存 — 预约数据要求实时性
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - 获取预约列表
export async function GET() {
  try {
    const allAppointments = await db.select().from(appointments).orderBy(appointments.id);

    // 获取所有预约ID
    const appointmentIds = allAppointments.map(a => a.id);

    // 查询对应的签到记录 - 使用简单的select而不是query
    const visitRecordsList = await db.select().from(visitRecords);

    // 为每个预约添加签到/签退状态
    const appointmentsWithStatus = allAppointments.map(appointment => {
      const visitRecord = visitRecordsList.find(r => r.appointmentId === appointment.id);

      return {
        ...appointment,
        // 签到状态
        hasCheckedIn: !!visitRecord?.checkInTime,
        checkInTime: visitRecord?.checkInTime?.toISOString() || null,
        // 签退状态
        hasCheckedOut: !!visitRecord?.checkOutTime,
        checkOutTime: visitRecord?.checkOutTime?.toISOString() || null,
        // 访问状态
        visitStatus: visitRecord?.visitStatus || null,
      };
    });

    return NextResponse.json(appointmentsWithStatus);
  } catch (error) {
    console.error('获取预约列表失败:', error);
    return NextResponse.json({ error: '获取预约列表失败' }, { status: 500 });
  }
}

// POST - 创建预约
export async function POST(request: NextRequest) {
  try {
    // 认证 + 角色校验（员工和管理员可创建预约）
    const authResult = requireAuth(request, ['admin', 'employee']);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    console.log('接收到的预约数据:', JSON.stringify(body, null, 2));

    const {
      visitorName,
      visitorIdCard,
      visitorPhone,
      visitorCount,
      company,
      visitorType,
      visitObject,
      visitPurpose,
      appointmentDate,
      appointmentTime,
      applicantId,
      applicantName,
      licensePlate,
      vehicleModel,
      needMeal,
      notes,
      visitors, // 随访人员列表
    } = body;

    // 检查黑名单
    if (visitorIdCard) {
      const blacklisted = await checkBlacklist(visitorIdCard);
      if (blacklisted) {
        return NextResponse.json({ error: '该人员已被列入黑名单，无法创建预约', blacklisted: true }, { status: 403 });
      }
    }

    // 解析日期字符串为 UTC 时间存储
    // 目标：用户选"2026-04-27"，查询 AT TIME ZONE 'Asia/Shanghai' 后显示"2026-04-27"
    // 原理：UTC 16:00 = 上海次日 00:00 → 要显示04-27，需存 UTC 04-26 16:00
    // 公式：Date.UTC(y, m-1, d-1, 16, 0, 0)
    // 验证：Date.UTC(2026,3,26,16,0,0) = 2026-04-26T16:00:00Z
    //       AT TIME ZONE 'Asia/Shanghai' → 2026-04-27 00:00:00 → date = 04-27 ✅
    const [y, m, d] = appointmentDate.split('-').map(Number);
    const localDate = new Date(Date.UTC(y, m - 1, d - 1, 16, 0, 0));

    // 检查当天是否有相同手机号的活跃预约（同一上海日期，排除已取消/已签退的）
    // 存储为 UTC (d-1, 16:00)，重复检查窗口也用相同逻辑
    const checkDate = new Date(Date.UTC(y, m - 1, d - 1, 16, 0, 0));
    const nextDate = new Date(Date.UTC(y, m - 1, d - 1, 16, 0, 0) + 24 * 60 * 60 * 1000);

    const existingAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.visitorPhone, visitorPhone),
          sql`${appointments.appointmentDate} >= ${checkDate}`,
          sql`${appointments.appointmentDate} < ${nextDate}`,
          sql`${appointments.status} NOT IN ('cancelled', 'checked_out')`
        )
      );

    if (existingAppointments.length > 0) {
      return NextResponse.json({ 
        error: '检测到相同手机号在当天已有预约记录，请确认是否为同一访客。如需继续预约，请联系管理员。',
        duplicate: true,
        existingAppointment: existingAppointments[0]
      }, { status: 400 });
    }

    // 创建预约记录
    const visitorCategory = VISITOR_TYPE_CONFIG[visitorType]?.category || '';
    console.log('visitorType:', visitorType, 'visitorCategory:', visitorCategory);

    // 生成访客编号：V + 预约日期(YYYYMMDD) + 3位序号（按预约日期编序，同天连号）
    const dateStr = appointmentDate.replace(/-/g, '');

    // 使用序列表获取该预约日期的序号（原子操作，避免并发冲突）
    const seqResult = await db.execute(sql`
      INSERT INTO visitor_code_sequences (date, last_seq)
      VALUES (${appointmentDate}::date, 1)
      ON CONFLICT (date)
      DO UPDATE SET last_seq = visitor_code_sequences.last_seq + 1
      RETURNING last_seq
    `);

    const seq = seqResult.rows[0].last_seq as number;
    const visitorCode = `V${dateStr}${String(seq).padStart(3, '0')}`;

    const insertData = {
      visitorCode,
      visitorName,
      visitorIdCard,
      visitorPhone,
      visitorCount,
      company,
      visitorType,
      visitorCategory,
      visitObject,
      visitPurpose,
      appointmentDate: localDate,
      appointmentTime,
      needMeal: needMeal || false,
      status: 'scheduled', // 员工创建直接通过，无需审批
      applicantId,
      applicantName,
      createdBy: 'employee', // 员工创建
      notes,
    };
    console.log('插入数据:', JSON.stringify(insertData, null, 2));

    const newAppointment = await db.insert(appointments).values(insertData).returning();

    // 创建车辆记录：主车牌 + 随访人员车辆
    const config = VISITOR_TYPE_CONFIG[visitorType] || ({} as any);
    const vehiclePassColor = config.vehiclePassColor || 'red';

    // 主车牌（主访客车，followerName 为空）
    if (licensePlate) {
      await db.insert(vehicles).values({
        appointmentId: newAppointment[0].id,
        licensePlate: licensePlate.trim(),
        vehicleModel: vehicleModel || 'unknown',
        vehicleType: 'car',
        vehiclePassColor,
        passNumber: `V${newAppointment[0].id}-${licensePlate}`,
        followerName: null,
        followerPhone: null,
      });
    }

    // 随访人员车辆（所有有姓名的随访人员都要保存，无论是否有车牌）
    if (Array.isArray(visitors)) {
      for (const v of visitors) {
        if (!v.name?.trim()) continue; // 没姓名的跳过

        await db.insert(vehicles).values({
          appointmentId: newAppointment[0].id,
          licensePlate: v.licensePlate?.trim() || `无车牌-${v.name.trim()}`,
          vehicleModel: '',
          vehicleType: 'car',
          vehiclePassColor,
          passNumber: `V${newAppointment[0].id}-${(v.licensePlate?.trim() || v.name.trim())}`,
          followerName: v.name.trim(),
          followerPhone: v.phone?.trim() || null,
        });
      }
    }

    return NextResponse.json(newAppointment[0], { status: 201 });
  } catch (error: any) {
    console.error('创建预约失败:', error);
    const errorMessage = error?.message || '创建预约失败';
    const errorDetail = error?.detail || error?.code || errorMessage;
    console.error('错误详情:', errorMessage, 'SQL错误:', errorDetail);
    return NextResponse.json({ error: '创建预约失败', details: errorDetail, fullError: errorMessage }, { status: 500 });
  }
}

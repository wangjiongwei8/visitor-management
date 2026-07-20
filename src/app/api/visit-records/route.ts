import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { visitors, visitRecords, appointments, vehicles, longTermVehicles, VISITOR_TYPE_CONFIG } from '@/storage/database/shared/schema';
import { eq, or } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';
import { checkBlacklist } from '@/lib/blacklist';

// 禁用路由缓存 — 签到记录数据要求实时性
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

// GET - 获取签到记录
export async function GET() {
  try {
    const records = await db.select().from(visitRecords);
    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json({ error: '获取签到记录失败' }, { status: 500 });
  }
}

// POST - 签到
export async function POST(request: NextRequest) {
  try {
    // 认证 + 角色校验（门卫和管理员可签到）
    const authResult = requireAuth(request, ['admin', 'security']);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { visitorIdCard, visitorPhone, appointmentId, isLongTermVehicle } = body;

    // 检查黑名单（通过身份证号或手机号关联查询）
    if (visitorIdCard) {
      const blacklisted = await checkBlacklist(visitorIdCard);
      if (blacklisted) {
        return NextResponse.json({ error: '该人员已被列入黑名单，无法签到入厂', blacklisted: true }, { status: 403 });
      }
    }

    // 处理长约车签到（isLongTermVehicle 为 true 或 appointmentId 为负数）
    if (isLongTermVehicle || (appointmentId && appointmentId < 0)) {
      const longTermVehicleId = Math.abs(appointmentId || 0);

      // 查询长约车信息
      const longTermVehicleList = await db
        .select()
        .from(longTermVehicles)
        .where(eq(longTermVehicles.id, longTermVehicleId));

      if (longTermVehicleList.length === 0) {
        return NextResponse.json({ error: '未找到长约车信息' }, { status: 404 });
      }

      const vehicle = longTermVehicleList[0];

      // 检查长约车状态
      if (vehicle.status !== 'active') {
        return NextResponse.json({ error: '该长约车已失效' }, { status: 400 });
      }

      // 生成通行牌号
      const passNumber = `L${Date.now().toString().slice(-6)}`;

      // 创建签到记录
      const visitRecord = await db
        .insert(visitRecords)
        .values({
          visitorId: 0,
          visitorName: vehicle.driverName || vehicle.personName || '长约人员',
          visitorIdCard: '',
          visitorPhone: vehicle.driverPhone || vehicle.personPhone || '',
          appointmentId: null,
          longTermVehicleId: longTermVehicleId,
          visitorType: 'long_term_supplier',
          visitorCategory: 'business',
          visitObject: vehicle.company || '长约人员',
          visitPurpose: '长约车辆进出',
          passNumber,
          passColor: 'yellow', // 长约车使用黄色通行牌
          checkInTime: new Date(),
          checkOutTime: null,
          visitStatus: 'visiting',
          riskLevel: 'green',
          notes: `长约签到 - ${vehicle.licensePlate || '人员'}`,
        })
        .returning();

      // 更新长约记录状态：标记为在厂
      await db
        .update(longTermVehicles)
        .set({
          isOnSite: true,
          lastVisitRecordId: visitRecord[0].id,
          updatedAt: new Date(),
        })
        .where(eq(longTermVehicles.id, longTermVehicleId));

      return NextResponse.json({
        ...visitRecord[0],
        totalVisitors: 1,
        vehicleInfo: [{
          licensePlate: vehicle.licensePlate,
          vehicleModel: vehicle.vehicleModel || '未知车型',
        }],
      }, { status: 201 });
    }

    // 优先使用预约ID进行签到
    if (appointmentId) {
      // 从预约表获取信息
      const appointmentList = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId));

      if (appointmentList.length === 0) {
        return NextResponse.json({ error: '未找到预约信息' }, { status: 404 });
      }

      const appointment = appointmentList[0];

      // 检查是否已签到
      if (appointment.status === 'checked_in' || appointment.status === 'checked_out') {
        return NextResponse.json({ error: '该访客已签到，请勿重复操作' }, { status: 400 });
      }

      // 检查预约是否被拒绝或取消
      if (appointment.status === 'rejected' || appointment.status === 'cancelled') {
        return NextResponse.json({ error: '该预约已被' + (appointment.status === 'rejected' ? '拒绝' : '取消') }, { status: 400 });
      }

      // 生成通行牌号
      const identifier = appointment.visitorIdCard || appointment.visitorPhone || '';
      const passNumber = `V${Date.now().toString().slice(-6)}${identifier.slice(-4)}`;

      // 获取访客类型配置
      const config = appointment.visitorType
        ? VISITOR_TYPE_CONFIG[appointment.visitorType]
        : VISITOR_TYPE_CONFIG['CUSTOMER'];

      // 创建签到记录
      const visitRecord = await db
        .insert(visitRecords)
        .values({
          visitorId: 0, // 预约签到时无关联visitor记录
          visitorName: maskName(appointment.visitorName),
          visitorIdCard: maskIdCard(appointment.visitorIdCard || ''),
          visitorPhone: maskPhone(appointment.visitorPhone),
          appointmentId: appointment.id,
          visitorType: appointment.visitorType || 'customer',
          visitorCategory: appointment.visitorCategory || 'business',
          visitObject: appointment.visitObject,
          visitPurpose: appointment.visitPurpose,
          passNumber,
          passColor: config?.passColor || 'green',
          checkInTime: new Date(),
          checkOutTime: null,
          visitStatus: 'visiting',
          riskLevel: 'green',
          notes: appointment.notes,
        })
        .returning();

      // 更新预约状态为已签到
      await db
        .update(appointments)
        .set({ status: 'checked_in', updatedAt: new Date() })
        .where(eq(appointments.id, appointmentId));

      // 查询关联的车辆信息
      const appointmentVehicles = await db
        .select()
        .from(vehicles)
        .where(eq(vehicles.appointmentId, appointmentId));

      return NextResponse.json({
        ...visitRecord[0],
        totalVisitors: appointment.visitorCount,
        vehicleInfo: appointmentVehicles.map(v => ({
          licensePlate: v.licensePlate,
          vehicleModel: v.vehicleModel || '',
        })),
      }, { status: 201 });
    }

    // 兼容旧逻辑：通过身份证或电话从visitors表查询
    if (!visitorIdCard && !visitorPhone) {
      return NextResponse.json({ error: '访客身份证或电话不能为空' }, { status: 400 });
    }

    // 查找访客信息（支持身份证或电话查询）
    const visitorList = await db
      .select()
      .from(visitors)
      .where(
        or(
          eq(visitors.idCard, visitorIdCard || ''),
          eq(visitors.phone, visitorPhone || '')
        )
      );

    if (visitorList.length === 0) {
      return NextResponse.json({ error: '未找到访客信息' }, { status: 404 });
    }

    const visitor = visitorList[0];

    // 生成通行牌号
    const identifier = visitorIdCard || visitorPhone || '';
    const passNumber = `V${Date.now().toString().slice(-6)}${identifier.slice(-4)}`;

    // 获取访客类型配置
    const config = visitor.visitorType
      ? VISITOR_TYPE_CONFIG[visitor.visitorType]
      : VISITOR_TYPE_CONFIG['CUSTOMER'];

    // 创建签到记录
    const visitRecord = await db
      .insert(visitRecords)
      .values({
        visitorId: visitor.id,
        visitorName: maskName(visitor.name),
        visitorIdCard: maskIdCard(visitor.idCard || ''),
        visitorPhone: maskPhone(visitor.phone),
        appointmentId: null,
        visitorType: visitor.visitorType || 'customer',
        visitorCategory: visitor.visitorCategory || 'business',
        visitObject: visitor.visitObject,
        visitPurpose: visitor.visitPurpose,
        passNumber,
        passColor: config?.passColor || 'green',
        checkInTime: new Date(),
        checkOutTime: null,
        visitStatus: 'visiting',
        riskLevel: 'green',
        notes: visitor.notes,
      })
      .returning();

    // 更新访客状态为已签到
    await db
      .update(visitors)
      .set({ status: 'checked_in' })
      .where(eq(visitors.id, visitor.id));

    return NextResponse.json(visitRecord[0], { status: 201 });
  } catch (error) {
    console.error('签到失败:', error);
    return NextResponse.json({ error: '签到失败' }, { status: 500 });
  }
}

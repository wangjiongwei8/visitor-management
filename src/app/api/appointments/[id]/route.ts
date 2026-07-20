import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appointments, vehicles, visitRecords } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { VISITOR_TYPE_CONFIG } from '@/lib/schema';
import { requireAuth } from '@/lib/auth';
import { getAppointmentVehicleSummaries } from '@/lib/appointment-vehicles';

// GET - 获取单个预约详情
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);

    const result = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, idNum))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ error: '预约不存在' }, { status: 404 });
    }

    // 检查是否已经签到
    const checkInRecord = await db
      .select()
      .from(visitRecords)
      .where(eq(visitRecords.appointmentId, idNum))
      .limit(1);

    // 获取车辆信息（兼容旧库：用显式列名避免 follower_* 列不存在导致崩溃）
    const aptSource = { id: result[0].id, visitorId: result[0].visitorId };
    const vehicleMap = await getAppointmentVehicleSummaries([aptSource]);
    const vehicleSummary = vehicleMap.get(result[0].id);

    // 主访客车牌
    const mainVehicle = vehicleSummary?.vehicleInfo?.[0] || null;
    // 随行人员
    const followerVehicles = vehicleSummary?.followers || [];

    return NextResponse.json({
      ...result[0],
      isCheckedIn: checkInRecord.length > 0 && !!checkInRecord[0].checkInTime,
      // 主车牌
      licensePlate: mainVehicle?.licensePlate || '',
      // 随行人员列表
      followers: followerVehicles.map(v => ({
        id: String(v.id),
        name: v.name || '',
        phone: v.phone || '',
        licensePlate: v.licensePlate,
      })),
    });
  } catch (error) {
    console.error('获取预约详情失败:', error);
    return NextResponse.json({ error: '获取预约详情失败' }, { status: 500 });
  }
}

// PATCH - 更新预约（签到前可修改，签到后不可修改）
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 认证 + 角色校验（员工可修改自己创建的预约）
    const authResult = requireAuth(request, ['admin', 'employee']);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const idNum = parseInt(id);
    const body = await request.json();

    // 签到后不允许修改
    const checkInRecord = await db
      .select()
      .from(visitRecords)
      .where(eq(visitRecords.appointmentId, idNum))
      .limit(1);

    if (checkInRecord.length > 0 && checkInRecord[0].checkInTime) {
      return NextResponse.json({ error: '该预约已完成签到，无法修改' }, { status: 400 });
    }

    // 构建更新数据
    const {
      visitorName,
      visitorIdCard,
      visitorPhone,
      visitorCount,
      company,
      visitorType,
      visitorCategory,
      visitObject,
      visitPurpose,
      appointmentDate,
      appointmentTime,
      licensePlate,
      needMeal,
      notes,
      visitors,
    } = body;

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (visitorName) updateData.visitorName = visitorName;
    if (visitorIdCard) updateData.visitorIdCard = visitorIdCard;
    if (visitorPhone) updateData.visitorPhone = visitorPhone;
    if (visitorCount !== undefined) updateData.visitorCount = visitorCount;
    if (company !== undefined) updateData.company = company;
    if (visitorType) updateData.visitorType = visitorType;
    if (visitorCategory) updateData.visitorCategory = visitorCategory;
    if (visitObject) updateData.visitObject = visitObject;
    if (visitPurpose) updateData.visitPurpose = visitPurpose;
    if (appointmentDate) { const [y,m,d] = appointmentDate.split('-').map(Number); updateData.appointmentDate = new Date(Date.UTC(y, m-1, d-1, 16, 0, 0)); }
    // 只保存完整时间（如 "09:00-11:00"），拒绝空/半残格式（如 "-11:00"、"09:00-"）
    if (appointmentTime && /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(appointmentTime)) updateData.appointmentTime = appointmentTime;
    if (needMeal !== undefined) updateData.needMeal = needMeal;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await db
      .update(appointments)
      .set(updateData)
      .where(eq(appointments.id, idNum))
      .returning();

    // ── 车辆信息更新：分别处理主车牌和随行人员车辆 ──
    const currentVehicles = await db.select().from(vehicles).where(eq(vehicles.appointmentId, idNum));
    const config = VISITOR_TYPE_CONFIG[visitorType] || ({} as any);
    const vehiclePassColor = (config as any).vehiclePassColor || 'red';

    // 1. 更新或插入主车牌（followerName 为空 = 主访客车）
    const mainVehicle = currentVehicles.find(v => !v.followerName);
    if (licensePlate && licensePlate.trim()) {
      if (mainVehicle) {
        // 主车已存在，只更新车牌号
        await db.update(vehicles)
          .set({ licensePlate: licensePlate.trim(), updatedAt: new Date() })
          .where(eq(vehicles.id, mainVehicle.id));
      } else {
        // 主车不存在，新建
        await db.insert(vehicles).values({
          appointmentId: idNum,
          licensePlate: licensePlate.trim(),
          vehicleModel: '',
          vehicleType: 'car',
          vehiclePassColor,
          passNumber: `V${idNum}-${licensePlate.trim()}`,
          followerName: null,
          followerPhone: null,
        });
      }
    }

    // 2. 处理随行人员（所有随访人员都要保存，无论是否有车牌）
    if (Array.isArray(visitors)) {
      for (const v of visitors) {
        if (!v.name || !v.name.trim()) continue; // 没姓名的随访人员跳过

        // 查找是否有匹配的已有记录（按姓名+手机号匹配，支持更新）
        const existingFollower = currentVehicles.find(fv =>
          fv.followerName === v.name.trim() && fv.followerPhone === (v.phone?.trim() || '')
        );

        if (existingFollower) {
          // 已有记录：更新信息
          const updateData: any = { updatedAt: new Date() };
          if (v.licensePlate?.trim()) updateData.licensePlate = v.licensePlate.trim();
          if (v.phone !== undefined) updateData.followerPhone = v.phone?.trim() || null;
          await db.update(vehicles).set(updateData).where(eq(vehicles.id, existingFollower.id));
        } else {
          // 新增随访人员（无论是否有车牌都要创建记录）
          await db.insert(vehicles).values({
            appointmentId: idNum,
            licensePlate: v.licensePlate?.trim() || `无车牌-${v.name.trim()}`,
            vehicleModel: '',
            vehicleType: 'car',
            vehiclePassColor,
            passNumber: `V${idNum}-${(v.licensePlate?.trim() || v.name.trim())}`,
            followerName: v.name.trim(),
            followerPhone: v.phone?.trim() || null,
          });
        }
      }
    }

    // 3. 删除已移除的随行人员车辆（当前提交的 visitors 中没有的旧记录）
    if (Array.isArray(visitors)) {
      const submittedNames = new Set(visitors.filter(v => v.name?.trim()).map(v => v.name.trim()));
      const followersToDelete = currentVehicles.filter(fv =>
        fv.followerName && !submittedNames.has(fv.followerName)
      );
      for (const fd of followersToDelete) {
        await db.delete(vehicles).where(eq(vehicles.id, fd.id));
      }
    }

    if (updated.length === 0) {
      return NextResponse.json({ error: '预约不存在' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('更新预约失败:', error);
    return NextResponse.json({ error: '更新预约失败' }, { status: 500 });
  }
}

// DELETE - 删除预约
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 认证 + 角色校验（员工可删除自己创建的预约，签到后不可删）
    const authResult = requireAuth(request, ['admin', 'employee']);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const idNum = parseInt(id);

    // 先检查是否已经签到
    const checkInRecord = await db
      .select()
      .from(visitRecords)
      .where(eq(visitRecords.appointmentId, idNum))
      .limit(1);

    if (checkInRecord.length > 0 && checkInRecord[0].checkInTime) {
      return NextResponse.json({ error: '该预约已完成签到，无法删除' }, { status: 400 });
    }

    const deleted = await db.delete(appointments).where(eq(appointments.id, idNum)).returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: '预约不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除预约失败:', error);
    return NextResponse.json({ error: '删除预约失败' }, { status: 500 });
  }
}

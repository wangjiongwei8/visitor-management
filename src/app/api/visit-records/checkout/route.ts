import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { visitRecords, appointments, longTermVehicles } from '@/storage/database/shared/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';

// POST - 签退
export async function POST(request: NextRequest) {
  try {
    // 认证 + 角色校验（门卫和管理员可签退）
    const authResult = requireAuth(request, ['admin', 'security']);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { visitorIdCard, visitorPhone, notes, visitRecordId } = body;

    let record;

    // 优先使用visitRecordId
    if (visitRecordId) {
      const records = await db
        .select()
        .from(visitRecords)
        .where(eq(visitRecords.id, visitRecordId));

      if (records.length === 0) {
        return NextResponse.json({ error: '未找到签到记录' }, { status: 404 });
      }
      record = records[0];
    } else {
      // 兼容旧逻辑：通过身份证或电话查询
      if (!visitorIdCard && !visitorPhone) {
        return NextResponse.json({ error: '访客身份证或电话不能为空' }, { status: 400 });
      }

      // 查找未签退的记录（支持身份证或电话查询）
      const records = await db
        .select()
        .from(visitRecords)
        .where(
          and(
            or(
              eq(visitRecords.visitorIdCard, visitorIdCard || ''),
              eq(visitRecords.visitorPhone, visitorPhone || '')
            ),
            isNull(visitRecords.checkOutTime)
          )
        )
        .orderBy(visitRecords.checkInTime);

      if (records.length === 0) {
        return NextResponse.json({ error: '未找到可签退的记录' }, { status: 404 });
      }

      // 取最新的记录进行签退
      record = records[records.length - 1];
    }

    // 检查是否已签退
    if (record.checkOutTime) {
      return NextResponse.json({ error: '该访客已签退' }, { status: 400 });
    }

    // 更新签退记录
    const updated = await db
      .update(visitRecords)
      .set({
        checkOutTime: new Date(),
        visitStatus: 'completed',
        notes: notes || record.notes,
        updatedAt: new Date(),
      })
      .where(eq(visitRecords.id, record.id))
      .returning();

    // 更新关联的预约状态
    if (record.appointmentId) {
      await db
        .update(appointments)
        .set({ status: 'checked_out', updatedAt: new Date() })
        .where(eq(appointments.id, record.appointmentId));
    }

    // 更新关联的长约记录状态
    if (record.longTermVehicleId) {
      await db
        .update(longTermVehicles)
        .set({
          isOnSite: false,
          // 保留 lastVisitRecordId，不清空（用于统计签到次数和追踪历史）
          updatedAt: new Date(),
        })
        .where(eq(longTermVehicles.id, record.longTermVehicleId));
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('签退失败:', error);
    return NextResponse.json({ error: '签退失败' }, { status: 500 });
  }
}

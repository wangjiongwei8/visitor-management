import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appointments } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { parseToken } from '@/lib/auth';

// POST - 驳回预约
export async function POST(request: NextRequest) {
  try {
    // 验证登录
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    const userData = parseToken(token);
    if (!userData) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const body = await request.json();
    const { appointmentId, rejectReason } = body;

    if (!appointmentId) {
      return NextResponse.json({ error: '缺少预约ID' }, { status: 400 });
    }

    // 查询预约
    const appointmentList = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (appointmentList.length === 0) {
      return NextResponse.json({ error: '预约不存在' }, { status: 404 });
    }

    const appointment = appointmentList[0];

    // 检查状态
    if (appointment.status !== 'pending') {
      return NextResponse.json({ error: '该预约不在待审批状态' }, { status: 400 });
    }

    // 权限检查：只有受访人或管理员可以驳回
    if (userData.role !== 'admin' && appointment.visitObject !== userData.name) {
      return NextResponse.json({ error: '您无权驳回此预约（仅受访人可操作）' }, { status: 403 });
    }

    // 更新状态为 rejected（已驳回）
    const updated = await db
      .update(appointments)
      .set({
        status: 'rejected',
        deptApproverId: userData.username,
        deptApproverName: userData.name,
        deptApprovalTime: new Date(),
        deptApprovalNotes: rejectReason || null,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId))
      .returning();

    return NextResponse.json({
      success: true,
      appointment: updated[0],
      message: '预约已驳回',
    });
  } catch (error) {
    console.error('驳回失败:', error);
    return NextResponse.json({ error: '驳回操作失败' }, { status: 500 });
  }
}

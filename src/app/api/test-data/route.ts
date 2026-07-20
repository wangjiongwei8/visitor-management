import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { visitors, appointments, vehicles, blacklist, visitRecords, safetyEquipment, receipts } from '@/lib/schema';
import { cookies } from 'next/headers';
import { parseToken } from '@/lib/auth';

export async function GET(request: Request) {
  // 生产环境保护
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '此接口在生产环境中不可用' }, { status: 403 });
  }

  // 认证检查
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) {
    return NextResponse.json({ error: '需要登录' }, { status: 401 });
  }
  const userData = parseToken(token);
  if (!userData || userData.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可执行此操作' }, { status: 403 });
  }

  try {
    const visitorCount = await db.select({ count: visitors.id }).from(visitors);
    const appointmentCount = await db.select({ count: appointments.id }).from(appointments);
    const vehicleCount = await db.select({ count: vehicles.id }).from(vehicles);
    const blacklistCount = await db.select({ count: blacklist.id }).from(blacklist);
    const visitRecordCount = await db.select({ count: visitRecords.id }).from(visitRecords);
    const safetyEquipmentCount = await db.select({ count: safetyEquipment.id }).from(safetyEquipment);
    const receiptCount = await db.select({ count: receipts.id }).from(receipts);

    const sampleVisitors = await db.select().from(visitors).limit(5);

    return NextResponse.json({
      summary: {
        visitors: visitorCount.length,
        appointments: appointmentCount.length,
        vehicles: vehicleCount.length,
        blacklist: blacklistCount.length,
        visitRecords: visitRecordCount.length,
        safetyEquipment: safetyEquipmentCount.length,
        receipts: receiptCount.length,
      },
      sampleVisitors,
    });
  } catch (error) {
    console.error('查询测试数据失败:', error);
    return NextResponse.json({ error: '查询测试数据失败', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

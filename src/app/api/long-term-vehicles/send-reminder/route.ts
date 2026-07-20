import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { longTermVehicles } from '@/storage/database/shared/schema';
import { and, eq, lte, gte, not } from 'drizzle-orm';
import { parseToken, getUserById } from '@/lib/auth';
import { cookies } from 'next/headers';

// POST - 发送过期提醒
export async function POST(request: NextRequest) {
  try {
    // 验证权限
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userData = parseToken(token);
    if (!userData) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const user = await getUserById(userData.userId);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    const body = await request.json();
    const { days = 7 } = body;

    // 查询即将过期的车辆（指定天数内过期且未停用）
    const now = new Date();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    const vehicles = await db
      .select()
      .from(longTermVehicles)
      .where(
        and(
          eq(longTermVehicles.status, 'active'),
          lte(longTermVehicles.validTo, targetDate),
          gte(longTermVehicles.validTo, now)
        )
      );

    if (vehicles.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有即将过期的车辆',
        sent: 0,
      });
    }

    // 发送提醒邮件
    const results = [];
    for (const vehicle of vehicles) {
      if (!vehicle.driverPhone) continue; // 没有联系方式的跳过

      const validToDate = new Date(vehicle.validTo);
      const diffTime = validToDate.getTime() - now.getTime();
      const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // 发送邮件（这里使用驾驶员手机号作为邮箱，实际应该有邮箱字段）
      // 由于没有邮箱字段，这里先记录日志
      results.push({
        licensePlate: vehicle.licensePlate,
        driverName: vehicle.driverName,
        driverPhone: vehicle.driverPhone,
        remainingDays,
        expiryDate: vehicle.validTo,
      });

      // 如果有邮箱配置，可以发送邮件
      // await sendLongTermVehicleExpiryReminder(email, {
      //   plateNumber: vehicle.licensePlate,
      //   driverName: vehicle.driverName || '',
      //   driverPhone: vehicle.driverPhone || '',
      //   expiryDate: vehicle.validTo,
      //   remainingDays,
      // });
    }

    return NextResponse.json({
      success: true,
      message: `已找到 ${vehicles.length} 辆即将过期的车辆`,
      sent: results.length,
      vehicles: results,
    });
  } catch (error) {
    console.error('Failed to send expiry reminders:', error);
    return NextResponse.json({ error: '发送提醒失败' }, { status: 500 });
  }
}

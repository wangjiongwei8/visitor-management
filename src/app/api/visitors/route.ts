import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { visitors, blacklist } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';

// GET - 获取访客列表
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request, ['admin']);
    if (authResult instanceof NextResponse) return authResult;

    const allVisitors = await db.select().from(visitors);
    return NextResponse.json(allVisitors);
  } catch (error) {
    return NextResponse.json({ error: '获取访客列表失败' }, { status: 500 });
  }
}

// POST - 创建访客
export async function POST(request: NextRequest) {
  try {
    const authResult = requireAuth(request, ['admin']);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { name, phone, company, visitPurpose, visitObject, visitObjectPhone, visitDate, notes, visitorType, visitorCategory, totalVisitors, vehicleInfo, entourageInfo } = body;

    // 解析日期字符串为 UTC 时间存储
    // 目标：用户选"2026-04-27"，查询 AT TIME ZONE 'Asia/Shanghai' 后显示"2026-04-27"
    // 原理：UTC 16:00 = 上海次日 00:00 → 要显示04-27，需存 UTC 04-26 16:00
    // 公式：Date.UTC(y, m-1, d-1, 16, 0, 0)
    let storedDate: Date;
    if (visitDate && typeof visitDate === 'string' && visitDate.includes('-')) {
      const [y, m, d] = visitDate.split('-').map(Number);
      storedDate = new Date(Date.UTC(y, m - 1, d - 1, 16, 0, 0));
    } else {
      storedDate = new Date(visitDate);
    }

    const newVisitor = await db.insert(visitors).values({
      name,
      phone,
      company,
      visitPurpose,
      visitObject,
      visitObjectPhone,
      visitDate: storedDate,
      notes,
      visitorType,
      visitorCategory,
      totalVisitors: totalVisitors || 1,
      vehicleInfo,
      entourageInfo,
    }).returning();

    return NextResponse.json(newVisitor[0], { status: 201 });
  } catch (error) {
    console.error('创建访客失败:', error);
    return NextResponse.json({ error: '创建访客失败' }, { status: 500 });
  }
}

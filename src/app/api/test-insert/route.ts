'use server';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appointments } from '@/lib/schema';
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
    // 测试插入
    const result = await db.insert(appointments).values({
      visitorName: '测试',
      visitorIdCard: '110101199001011234',
      visitorPhone: '13800138000',
      visitorCount: 1,
      company: '测试公司',
      visitorType: 'customer',
      visitorCategory: 'business',
      visitObject: '李四',
      visitPurpose: '测试',
      appointmentDate: new Date('2026-03-25'),
      appointmentTime: '09:00-12:00',
      needMeal: false,
      applicantId: 'test',
      applicantName: '测试',
      notes: 'API测试',
    }).returning();

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('测试插入失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message,
      detail: error?.detail,
      code: error?.code,
      table: error?.table,
      constraint: error?.constraint
    }, { status: 500 });
  }
}

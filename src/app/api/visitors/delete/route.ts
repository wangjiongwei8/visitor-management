import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { visitors, visitRecords } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';

// DELETE - 删除访客记录（仅用于异常数据处理）
export async function DELETE(request: NextRequest) {
  try {
    const authResult = requireAuth(request, ['admin']);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const visitorId = searchParams.get('id');
    const reason = searchParams.get('reason') || '异常数据清理';

    if (!visitorId) {
      return NextResponse.json({ error: '缺少访客ID' }, { status: 400 });
    }

    // 查询访客信息
    const visitorInfo = await db
      .select()
      .from(visitors)
      .where(eq(visitors.id, parseInt(visitorId)))
      .limit(1);

    if (visitorInfo.length === 0) {
      return NextResponse.json({ error: '访客记录不存在' }, { status: 404 });
    }

    const visitor = visitorInfo[0];

    // 查询访问记录
    const records = await db
      .select()
      .from(visitRecords)
      .where(eq(visitRecords.visitorId, parseInt(visitorId)));

    // 判断是否为异常数据
    const isAbnormal = visitor.status === 'checked_in' &&
      records.some(r => r.checkInTime && !r.checkOutTime);

    // 删除相关的访问记录
    if (records.length > 0) {
      await db
        .delete(visitRecords)
        .where(eq(visitRecords.visitorId, parseInt(visitorId)));
    }

    // 删除访客记录
    await db
      .delete(visitors)
      .where(eq(visitors.id, parseInt(visitorId)));

    return NextResponse.json({
      success: true,
      message: '删除成功',
      isAbnormal,
    });
  } catch (error) {
    console.error('删除访客失败:', error);
    return NextResponse.json({ error: '删除访客失败' }, { status: 500 });
  }
}

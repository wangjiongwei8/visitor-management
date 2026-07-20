import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { visitRecords, blacklist } from '@/lib/schema';
import { or, eq, like, and, isNull } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';

// 禁用路由缓存 — 访客风险查询数据要求实时性
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - 搜索访客记录（门卫端，包含风险等级）
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request, ['admin', 'security']);
    if (authResult instanceof NextResponse) return authResult;

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q');

    if (!q) {
      return NextResponse.json({ error: '搜索内容不能为空' }, { status: 400 });
    }

    // 搜索访客记录
    const records = await db
      .select()
      .from(visitRecords)
      .where(
        or(
          like(visitRecords.visitorName, `%${q}%`),
          eq(visitRecords.visitorIdCard, q),
          like(visitRecords.visitorPhone, `%${q}%`)
        )
      )
      .orderBy(visitRecords.checkInTime);

    if (records.length > 0) {
      // 返回最新的记录
      const latestRecord = records[records.length - 1];
      return NextResponse.json({
        type: 'record',
        data: latestRecord,
        message: '找到访客记录',
      });
    }

    // 如果没有记录，检查是否在黑名单中
    const blacklisted = await db.select().from(blacklist).where(eq(blacklist.idCard, q));
    if (blacklisted.length > 0) {
      const blItem = blacklisted[0];
      const isActive = blItem.isPermanent || (blItem.expiryDate && new Date(blItem.expiryDate) > new Date());

      if (isActive) {
        return NextResponse.json({
          type: 'blacklist',
          data: {
            visitorName: blItem.name,
            visitorIdCard: blItem.idCard,
            visitorPhone: blItem.phone || '',
            visitObject: '黑名单人员',
            visitPurpose: blItem.reason,
            checkInTime: blItem.createdAt,
            checkOutTime: null,
            visitStatus: 'blocked' as const,
            riskLevel: 'red' as const,
          },
          message: '该访客在黑名单中',
        });
      }
    }

    return NextResponse.json({
      type: 'notfound',
      data: null,
      message: '未找到访客信息',
    });
  } catch (error) {
    console.error('搜索访客失败:', error);
    return NextResponse.json({ error: '搜索访客失败' }, { status: 500 });
  }
}

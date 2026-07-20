import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { blacklist } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';

// GET - 获取黑名单
export async function GET() {
  try {
    const allBlacklist = await db.select().from(blacklist).orderBy(blacklist.id);
    return NextResponse.json(allBlacklist);
  } catch (error) {
    return NextResponse.json({ error: '获取黑名单失败' }, { status: 500 });
  }
}

// POST - 添加到黑名单
export async function POST(request: NextRequest) {
  try {
    // 认证 + 角色校验（仅管理员可操作黑名单）
    const authResult = requireAuth(request, ['admin']);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { name, idCard, phone, reason, blacklistedBy, isPermanent, expiryDate } = body;

    // 检查身份证是否已在黑名单中
    const existing = await db.select().from(blacklist).where(eq(blacklist.idCard, idCard));
    if (existing.length > 0) {
      return NextResponse.json({ error: '该身份证号已在黑名单中' }, { status: 400 });
    }

    const newBlacklistItem = await db.insert(blacklist).values({
      name,
      idCard,
      phone,
      reason,
      blacklistedBy,
      isPermanent,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
    }).returning();

    return NextResponse.json(newBlacklistItem[0], { status: 201 });
  } catch (error) {
    console.error('添加黑名单失败:', error);
    return NextResponse.json({ error: '添加黑名单失败' }, { status: 500 });
  }
}

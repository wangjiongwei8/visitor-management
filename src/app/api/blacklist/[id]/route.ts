import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { blacklist } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';

// DELETE - 从黑名单移除
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 认证 + 角色校验（仅管理员可操作黑名单）
    const authResult = requireAuth(request, ['admin']);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const idNum = parseInt(id);

    const deleted = await db.delete(blacklist).where(eq(blacklist.id, idNum)).returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: '黑名单记录不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('移除黑名单失败:', error);
    return NextResponse.json({ error: '移除黑名单失败' }, { status: 500 });
  }
}

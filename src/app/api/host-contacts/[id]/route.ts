import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hostContacts } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';

// PATCH - 更新受访人
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证 + 角色校验
    const authResult = requireAuth(request, ['admin']);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const idNum = parseInt(id);
    const body = await request.json();

    const { name, department, phone, email, position } = body;

    if (!name || !department) {
      return NextResponse.json({ error: '姓名和部门不能为空' }, { status: 400 });
    }

    const updated = await db
      .update(hostContacts)
      .set({
        name,
        department,
        phone,
        email,
        position,
        updatedAt: new Date(),
      })
      .where(eq(hostContacts.id, idNum))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: '受访人不存在' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('更新受访人失败:', error);
    return NextResponse.json({ error: '更新受访人失败' }, { status: 500 });
  }
}

// DELETE - 删除受访人
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证 + 角色校验
    const authResult = requireAuth(request, ['admin']);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const idNum = parseInt(id);

    const deleted = await db
      .delete(hostContacts)
      .where(eq(hostContacts.id, idNum))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: '受访人不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除受访人失败:', error);
    return NextResponse.json({ error: '删除受访人失败' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseToken, createDefaultUsers } from '@/lib/auth';

// GET - 初始化默认用户（仅允许已认证的管理员）
export async function GET(request: Request) {
  // 生产环境禁止
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '此接口在生产环境中不可用' }, { status: 403 });
  }

  // 必须管理员认证
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: '未登录，请先以管理员身份登录' }, { status: 401 });
    }
    const userData = parseToken(token);
    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: '仅管理员可执行此操作' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: '认证失败' }, { status: 401 });
  }

  try {
    await createDefaultUsers();
    return NextResponse.json({ message: 'Default users created successfully' });
  } catch (error) {
    console.error('Failed to create default users:', error);
    return NextResponse.json({ error: 'Failed to create default users' }, { status: 500 });
  }
}

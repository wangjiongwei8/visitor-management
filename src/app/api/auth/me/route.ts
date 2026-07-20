import { NextResponse } from 'next/server';
import { parseToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// GET - 获取当前登录用户信息
// 优化：直接从 token 中获取用户信息，避免数据库查询
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userData = parseToken(token);
    if (!userData) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    // 直接从 token 中返回用户信息，避免数据库查询
    return NextResponse.json({
      id: userData.userId,
      username: userData.username,
      name: userData.name,
      role: userData.role,
    });
  } catch (error) {
    console.error('Get current user failed:', error);
    return NextResponse.json({ error: '获取用户信息失败' }, { status: 500 });
  }
}

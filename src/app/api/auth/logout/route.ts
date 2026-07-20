import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// POST - 用户登出
export async function POST() {
  try {
    const cookieStore = await cookies();

    // 清除 cookie
    cookieStore.delete('auth-token');

    return NextResponse.json({ message: '登出成功' });
  } catch (error) {
    console.error('Logout failed:', error);
    return NextResponse.json({ error: '登出失败' }, { status: 500 });
  }
}

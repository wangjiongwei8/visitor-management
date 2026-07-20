import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// 禁用路由缓存
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - 健康检查（供 Docker/Nginx 使用）
export async function GET() {
  try {
    // 检查数据库连通性
    await db.execute(sql`SELECT 1`);

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: 'connected',
    });
  } catch (error) {
    console.error('[Health] 数据库连接检查失败:', error);
    return NextResponse.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      db: 'disconnected',
    }, { status: 503 });
  }
}

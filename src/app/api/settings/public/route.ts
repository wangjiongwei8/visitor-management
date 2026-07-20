import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { systemSettings, SYSTEM_SETTING_KEYS } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET - 公开获取审核开关状态（无需认证）
export async function GET() {
  try {
    const settings = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, SYSTEM_SETTING_KEYS.REVIEW_ENABLED))
      .limit(1);

    const reviewEnabled = settings.length > 0 ? settings[0].value === 'true' : true; // 默认为 true

    return NextResponse.json({ reviewEnabled });
  } catch (error) {
    console.error('获取公开设置失败:', error);
    // 出错时默认返回 true（安全默认值）
    return NextResponse.json({ reviewEnabled: true });
  }
}

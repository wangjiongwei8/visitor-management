import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { systemSettings } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { SYSTEM_SETTING_KEYS } from '@/storage/database/shared/schema';
import { requireAuth } from '@/lib/auth';

// GET - 获取系统设置
export async function GET(request: NextRequest) {
  try {
    // 认证 + 角色校验
    const authResult = requireAuth(request, ['admin']);
    if (authResult instanceof NextResponse) return authResult;

    const settings = await db.select().from(systemSettings);
    
    // 转换为键值对对象
    const settingsMap: Record<string, string> = {};
    settings.forEach(setting => {
      settingsMap[setting.key] = setting.value;
    });

    return NextResponse.json({
      autoApprove: settingsMap[SYSTEM_SETTING_KEYS.AUTO_APPROVE] === 'true',
      reviewEnabled: settingsMap[SYSTEM_SETTING_KEYS.REVIEW_ENABLED] === 'true',
    });
  } catch (error) {
    console.error('获取系统设置失败:', error);
    return NextResponse.json({ error: '获取系统设置失败' }, { status: 500 });
  }
}

// POST - 更新系统设置
export async function POST(request: NextRequest) {
  try {
    // 认证 + 角色校验
    const authResult = requireAuth(request, ['admin']);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { autoApprove, reviewEnabled } = body;

    // 处理一键审批设置
    if (autoApprove !== undefined) {
      await upsertSetting(SYSTEM_SETTING_KEYS.AUTO_APPROVE, autoApprove ? 'true' : 'false', '一键审批开关');
    }

    // 处理审核开关设置
    if (reviewEnabled !== undefined) {
      await upsertSetting(SYSTEM_SETTING_KEYS.REVIEW_ENABLED, reviewEnabled ? 'true' : 'false', '审核开关：开启后访客预约需被访人审核');
    }

    return NextResponse.json({ 
      success: true,
      message: '设置已保存'
    });
  } catch (error) {
    console.error('更新系统设置失败:', error);
    return NextResponse.json({ error: '更新系统设置失败' }, { status: 500 });
  }
}

// 辅助函数：更新或创建设置
async function upsertSetting(key: string, value: string, description: string) {
  const existingSettings = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key));

  if (existingSettings.length > 0) {
    await db
      .update(systemSettings)
      .set({
        value,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.key, key));
  } else {
    await db.insert(systemSettings).values({
      key,
      value,
      description,
    });
  }
}

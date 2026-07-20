import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { passwordPolicy } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

// GET - 获取密码策略（公开接口，用于前端验证）
export async function GET() {
  try {
    const policies = await db
      .select()
      .from(passwordPolicy)
      .where(eq(passwordPolicy.isActive, true))
      .limit(1);

    if (policies.length === 0) {
      // 返回默认策略
      return NextResponse.json({
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecialChar: true,
        specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
      });
    }

    const policy = policies[0];
    return NextResponse.json({
      minLength: policy.minLength,
      requireUppercase: policy.requireUppercase,
      requireLowercase: policy.requireLowercase,
      requireNumber: policy.requireNumber,
      requireSpecialChar: policy.requireSpecialChar,
      specialChars: policy.specialChars,
    });
  } catch (error) {
    console.error('Failed to fetch password policy:', error);
    // 返回默认策略
    return NextResponse.json({
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecialChar: true,
      specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    });
  }
}

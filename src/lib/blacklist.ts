import { db } from '@/lib/db';
import { blacklist } from '@/lib/schema';
import { eq, and, or, isNull, gte } from 'drizzle-orm';

/**
 * 检查身份证号是否在黑名单中（且未过期）
 * @param idCard 身份证号
 * @returns 如果在黑名单中返回黑名单记录，否则返回 null
 */
export async function checkBlacklist(idCard: string): Promise<{
  name: string;
  reason: string;
  isPermanent: boolean;
  expiryDate: Date | null;
} | null> {
  if (!idCard) return null;

  try {
    const now = new Date();
    // 查询该身份证的黑名单记录（永久 或 未过期的临时）
    const results = await db
      .select({
        name: blacklist.name,
        reason: blacklist.reason,
        isPermanent: blacklist.isPermanent,
        expiryDate: blacklist.expiryDate,
      })
      .from(blacklist)
      .where(
        and(
          eq(blacklist.idCard, idCard),
          or(
            eq(blacklist.isPermanent, true),  // 永久黑名单
            gte(blacklist.expiryDate, now)     // 临时黑名单未过期
          )
        )
      )
      .limit(1);

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('[Blacklist] 查询黑名单失败:', error);
    // 查询失败时不阻塞主流程，仅记录日志
    return null;
  }
}

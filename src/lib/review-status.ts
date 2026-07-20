/**
 * 审核开关相关的纯逻辑（可单测，无副作用）。
 *
 * 这些函数集中表达本系统的核心决策，便于在单元测试中作为「预期值来源」，
 * 也方便后续在 API route 中复用，避免逻辑漂移：
 *
 *  - resolveReviewStatus: 审核开关 → 预约初始状态
 *      reviewEnabled = true  → 'pending'  （需被访人审核）
 *      reviewEnabled = false → 'scheduled'（自动通过）
 *
 *  - parseReviewEnabledValue: system_settings 中 'review_enabled' 字段为字符串
 *      'true' → true；其它/'false'/缺失 → 默认 true（安全默认值，开启审核）
 *
 *  - isHostContactValid: 被访人匹配校验
 *      无匹配结果（空数组）→ 无效（硬阻止提交）；有结果 → 有效
 */

export type ReviewResolvableStatus = 'pending' | 'scheduled';

export interface HostContactLike {
  id?: number;
  name: string;
  department?: string;
  phone?: string;
}

/** 审核开关 → 预约初始状态 */
export function resolveReviewStatus(reviewEnabled: boolean): ReviewResolvableStatus {
  return reviewEnabled ? 'pending' : 'scheduled';
}

/**
 * 解析 system_settings 中的 review_enabled 字符串值。
 * @param rawValue 数据库存储的字符串值（'true' | 'false' | 其它）
 * @param exists   该设置记录是否存在
 * @returns 是否开启审核（缺失记录时默认 true，安全起见开启审核）
 */
export function parseReviewEnabledValue(
  rawValue: string | null | undefined,
  exists: boolean
): boolean {
  if (!exists) return true;
  return rawValue === 'true';
}

/**
 * 被访人匹配是否通过校验。
 * 受访人不在 host_contacts 清单中（无匹配结果）→ 返回 false（硬阻止提交）。
 */
export function isHostContactValid(results: HostContactLike[]): boolean {
  return Array.isArray(results) && results.length > 0;
}

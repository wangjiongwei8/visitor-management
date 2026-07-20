import { describe, it, expect } from 'vitest';
import {
  resolveReviewStatus,
  parseReviewEnabledValue,
  isHostContactValid,
} from '@/lib/review-status';

describe('resolveReviewStatus — 审核开关 → 预约初始状态', () => {
  it('审核开启(true) → pending（需被访人审核）', () => {
    expect(resolveReviewStatus(true)).toBe('pending');
  });

  it('审核关闭(false) → scheduled（自动通过）', () => {
    expect(resolveReviewStatus(false)).toBe('scheduled');
  });

  it('仅返回两种合法状态', () => {
    expect(['pending', 'scheduled']).toContain(resolveReviewStatus(true));
    expect(['pending', 'scheduled']).toContain(resolveReviewStatus(false));
  });
});

describe('parseReviewEnabledValue — system_settings 字符串 → boolean', () => {
  it("'true' → true", () => {
    expect(parseReviewEnabledValue('true', true)).toBe(true);
  });

  it("'false' → false", () => {
    expect(parseReviewEnabledValue('false', true)).toBe(false);
  });

  it("缺失记录(不存在) → 默认 true（安全默认值：开启审核）", () => {
    expect(parseReviewEnabledValue(undefined, false)).toBe(true);
    expect(parseReviewEnabledValue(null, false)).toBe(true);
    expect(parseReviewEnabledValue('', false)).toBe(true);
  });

  it("存在但为 'false' → false（不触发默认值）", () => {
    expect(parseReviewEnabledValue('false', true)).toBe(false);
  });

  it("存在但为异常字符串(如 '1'/'yes') → 默认 false（仅 'true' 为真）", () => {
    expect(parseReviewEnabledValue('1', true)).toBe(false);
    expect(parseReviewEnabledValue('yes', true)).toBe(false);
  });
});

describe('isHostContactValid — 被访人匹配校验（硬阻止）', () => {
  it('无匹配结果（空数组）→ 无效（应硬阻止提交）', () => {
    expect(isHostContactValid([])).toBe(false);
  });

  it('有匹配结果 → 有效', () => {
    expect(isHostContactValid([{ id: 1, name: '张三', department: '技术部' }])).toBe(true);
  });

  it('多个匹配结果 → 有效', () => {
    expect(
      isHostContactValid([
        { id: 1, name: '张三' },
        { id: 2, name: '李四' },
      ])
    ).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ---- 共享的可控 mock 状态（vi.hoisted 保证工厂内可访问） ----
const h = vi.hoisted(() => {
  const inserted: Record<string, unknown>[] = [];
  let settingRows: { value: string }[] = [{ value: 'true' }];

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(settingRows)),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((vals: Record<string, unknown>) => {
        inserted.push(vals);
        return { returning: vi.fn(() => Promise.resolve([{ id: 1, ...vals }])) };
      }),
    })),
    execute: vi.fn(() => Promise.resolve({ rows: [{ last_seq: 1 }] })),
  };

  return { inserted, db, setSettingRows: (rows: { value: string }[]) => { settingRows = rows; } };
});

// ---- mock 依赖模块 ----
vi.mock('@/lib/db', () => ({ db: h.db }));
vi.mock('@/lib/schema', () => ({
  appointments: 'appointments',
  visitors: 'visitors',
  vehicles: 'vehicles',
  VISITOR_TYPE_CONFIG: {
    customer: { category: 'business', vehiclePassColor: 'green' },
  },
}));
vi.mock('@/storage/database/shared/schema', () => ({
  systemSettings: 'systemSettings',
  SYSTEM_SETTING_KEYS: { REVIEW_ENABLED: 'review_enabled' },
}));
vi.mock('@/lib/blacklist', () => ({ checkBlacklist: vi.fn(() => false) }));
vi.mock('next/server', () => ({
  NextResponse: class {
    status: number;
    body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    static json(data: unknown, init?: { status?: number }) {
      return new this(data, init);
    }
    async json() {
      return this.body;
    }
  },
  NextRequest: class {},
}));

// 必须在 mock 之后导入被测模块
const { POST } = await import('@/app/api/scan-appointment/route');
import { resolveReviewStatus } from '@/lib/review-status';

function makeRequest(body: unknown, ip = '10.0.0.1') {
  return {
    json: async () => body,
    headers: {
      get: (k: string) => (k === 'x-forwarded-for' ? ip : null),
    },
    cookies: { get: () => undefined },
  } as unknown as NextRequest;
}

const baseBody = {
  visitorName: '张三',
  visitorPhone: '13800138000',
  visitorType: 'customer',
  visitObject: '李四',
  visitPurpose: '项目洽谈',
  appointmentDate: '2026-04-27',
  appointmentTime: '09:00',
};

describe('POST /api/scan-appointment — 审核开关分流', () => {
  beforeEach(() => {
    h.inserted.length = 0;
    h.setSettingRows([{ value: 'true' }]);
  });

  it('审核开启(review_enabled=true) → status=pending, createdBy=visitor', async () => {
    h.setSettingRows([{ value: 'true' }]);
    const res = await POST(makeRequest(baseBody, '1.1.1.1'));
    const data = (await res.json()) as { success?: boolean; reviewEnabled?: boolean };

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const appointment = h.inserted.find((v) => v.createdBy === 'visitor') as Record<string, unknown>;
    expect(appointment).toBeDefined();
    expect(appointment.status).toBe(resolveReviewStatus(true)); // 'pending'
    expect(appointment.status).toBe('pending');
    expect(appointment.createdBy).toBe('visitor');
    expect(data.reviewEnabled).toBe(true);
  });

  it('审核关闭(review_enabled=false) → status=scheduled, createdBy=visitor', async () => {
    h.setSettingRows([{ value: 'false' }]);
    const res = await POST(makeRequest(baseBody, '2.2.2.2'));
    const data = (await res.json()) as { success?: boolean; reviewEnabled?: boolean };

    expect(res.status).toBe(200);
    const appointment = h.inserted.find((v) => v.createdBy === 'visitor') as Record<string, unknown>;
    expect(appointment.status).toBe(resolveReviewStatus(false)); // 'scheduled'
    expect(appointment.status).toBe('scheduled');
    expect(appointment.createdBy).toBe('visitor');
    expect(data.reviewEnabled).toBe(false);
  });

  it('设置记录缺失 → 默认开启审核(true) → status=pending', async () => {
    h.setSettingRows([]); // 模拟查不到记录
    const res = await POST(makeRequest(baseBody, '3.3.3.3'));
    const data = (await res.json()) as { success?: boolean; reviewEnabled?: boolean };

    expect(res.status).toBe(200);
    const appointment = h.inserted.find((v) => v.createdBy === 'visitor') as Record<string, unknown>;
    expect(appointment.status).toBe('pending');
    expect(data.reviewEnabled).toBe(true);
  });

  it('缺少必填字段 → 400', async () => {
    const incomplete = { ...baseBody, visitorPhone: '' };
    const res = await POST(makeRequest(incomplete, '4.4.4.4'));
    expect(res.status).toBe(400);
  });
});

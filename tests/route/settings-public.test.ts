import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  let settingRows: any[] = [{ value: 'true' }];
  let throwSelect = false;

  const db = {
    select: vi.fn(() => {
      if (throwSelect) {
        const err: any = new Error('db down');
        return { from: () => { throw err; } };
      }
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(settingRows)),
          })),
        })),
      };
    }),
  };

  return {
    db,
    setSettingRows: (rows: any[]) => { settingRows = rows; },
    setThrow: (v: boolean) => { throwSelect = v; },
  };
});

vi.mock('@/lib/db', () => ({ db: h.db }));
vi.mock('@/storage/database/shared/schema', () => ({
  systemSettings: 'systemSettings',
  SYSTEM_SETTING_KEYS: { REVIEW_ENABLED: 'review_enabled' },
}));
vi.mock('next/server', () => ({
  NextResponse: class {
    status: number;
    body: any;
    constructor(body: any, init?: any) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    static json(data: any, init?: any) {
      return new this(data, init);
    }
    async json() {
      return this.body;
    }
  },
  NextRequest: class {},
}));

const { GET } = await import('@/app/api/settings/public/route');

describe('GET /api/settings/public — 公开返回审核开关', () => {
  beforeEach(() => {
    h.setSettingRows([{ value: 'true' }]);
    h.setThrow(false);
  });

  it("review_enabled='true' → reviewEnabled=true", async () => {
    h.setSettingRows([{ value: 'true' }]);
    const res = await GET();
    const data = await res.json();
    expect(data).toEqual({ reviewEnabled: true });
  });

  it("review_enabled='false' → reviewEnabled=false", async () => {
    h.setSettingRows([{ value: 'false' }]);
    const res = await GET();
    const data = await res.json();
    expect(data).toEqual({ reviewEnabled: false });
  });

  it('设置记录缺失 → 默认 true（安全默认值）', async () => {
    h.setSettingRows([]);
    const res = await GET();
    const data = await res.json();
    expect(data).toEqual({ reviewEnabled: true });
  });

  it('数据库异常 → 兜底返回 true', async () => {
    h.setThrow(true);
    const res = await GET();
    const data = await res.json();
    expect(data).toEqual({ reviewEnabled: true });
  });

  it('返回结构仅含 reviewEnabled 字段', async () => {
    const res = await GET();
    const data = await res.json();
    expect(Object.keys(data)).toEqual(['reviewEnabled']);
    expect(typeof data.reviewEnabled).toBe('boolean');
  });
});

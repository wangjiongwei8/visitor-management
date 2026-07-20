import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  let appointment: any = { id: 1, status: 'pending', visitObject: '李四' };
  let user: any = null;
  let returnEmpty = false;
  const updated: any[] = [];

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(returnEmpty ? [] : [appointment])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((vals: any) => {
        updated.push(vals);
        return {
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([{ id: 1, ...appointment, ...vals }])),
          })),
        };
      }),
    })),
  };

  const parseToken = vi.fn(() => user);

  return {
    db,
    updated,
    parseToken,
    setAppointment: (a: any) => { appointment = a; },
    setUser: (u: any) => { user = u; },
    setReturnEmpty: (v: boolean) => { returnEmpty = v; },
  };
});

vi.mock('@/lib/db', () => ({ db: h.db }));
vi.mock('@/lib/schema', () => ({ appointments: 'appointments' }));
vi.mock('@/lib/auth', () => ({ parseToken: h.parseToken }));
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

const { POST } = await import('@/app/api/appointments/reject/route');

function makeRequest(body: any, token?: string) {
  return {
    json: async () => body,
    cookies: {
      get: (k: string) => (k === 'auth-token' ? { value: token ?? '' } : undefined),
    },
    headers: { get: () => null },
  } as any;
}

describe('POST /api/appointments/reject — 拒绝预约（Q6: 无需原因）', () => {
  beforeEach(() => {
    h.updated.length = 0;
    h.setReturnEmpty(false);
    h.setAppointment({ id: 1, status: 'pending', visitObject: '李四' });
    h.setUser(null);
  });

  it('未登录 → 401', async () => {
    const res = await POST(makeRequest({ appointmentId: 1 }));
    expect(res.status).toBe(401);
  });

  it('token 失效 → 401', async () => {
    h.setUser(null);
    const res = await POST(makeRequest({ appointmentId: 1 }, 'expired-token'));
    expect(res.status).toBe(401);
  });

  it('预约不存在 → 404', async () => {
    h.setUser({ role: 'admin', name: '管理员', username: 'admin' });
    h.setReturnEmpty(true); // 模拟 DB 查无此预约
    const res = await POST(makeRequest({ appointmentId: 999 }, 'tok'));
    expect(res.status).toBe(404);
  });

  it('非 pending 状态 → 400', async () => {
    h.setUser({ role: 'admin', name: '管理员', username: 'admin' });
    h.setAppointment({ id: 1, status: 'scheduled', visitObject: '李四' });
    const res = await POST(makeRequest({ appointmentId: 1 }, 'tok'));
    expect(res.status).toBe(400);
  });

  it('员工非受访人 → 403', async () => {
    h.setUser({ role: 'employee', name: '王五', username: 'wangwu' });
    h.setAppointment({ id: 1, status: 'pending', visitObject: '李四' });
    const res = await POST(makeRequest({ appointmentId: 1 }, 'tok'));
    expect(res.status).toBe(403);
  });

  it('管理员拒绝（不带原因）→ status=rejected，deptApprovalNotes=null', async () => {
    h.setUser({ role: 'admin', name: '管理员', username: 'admin' });
    h.setAppointment({ id: 1, status: 'pending', visitObject: '李四' });
    const res = await POST(makeRequest({ appointmentId: 1 }, 'tok')); // 无 rejectReason
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(h.updated[0].status).toBe('rejected');
    expect(h.updated[0].deptApprovalNotes).toBeNull();
  });

  it('受访人本人拒绝（带原因）→ status=rejected，并记录原因', async () => {
    h.setUser({ role: 'employee', name: '李四', username: 'lisi' });
    h.setAppointment({ id: 1, status: 'pending', visitObject: '李四' });
    const res = await POST(makeRequest({ appointmentId: 1, rejectReason: '来访事由不明确' }, 'tok'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(h.updated[0].status).toBe('rejected');
    expect(h.updated[0].deptApprovalNotes).toBe('来访事由不明确');
  });
});

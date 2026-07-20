#!/usr/bin/env node
/**
 * 访客管理系统 —— 真实运行时冒烟测试
 *
 * 前置：应用已连真实 PostgreSQL 启动（默认 http://localhost:4000）。
 * 应用启动时会自动建表并创建默认账号（admin/security/employee/visitor），
 * 如未启用自举，请先 `pnpm db:push` 并访问 /api/init-users（开发模式）。
 *
 * 用法：
 *   node scripts/smoke-test.mjs                 # 默认 http://localhost:4000
 *   BASE_URL=http://localhost:4000 node scripts/smoke-test.mjs
 *
 * 覆盖：健康检查 / 登录 / 受访人创建 / 模式一(预审单+门卫签到签退) / 模式二(扫码+被访人审核)
 */
const BASE = process.env.BASE_URL || 'http://localhost:4000';

let pass = 0;
let fail = 0;
const log = (ok, msg) => {
  if (ok) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
};

async function call(method, path, { body, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data, cookie: setCookie };
}

function extractToken(setCookie) {
  if (!setCookie) return '';
  const m = setCookie.match(/auth-token=([^;]+)/);
  return m ? `auth-token=${m[1]}` : '';
}

const today = new Date();
const y = today.getFullYear();
const m = String(today.getMonth() + 1).padStart(2, '0');
const d = String(today.getDate()).padStart(2, '0');
const todayStr = `${y}-${m}-${d}`;

async function main() {
  console.log(`\n=== 访客管理系统冒烟测试 @ ${BASE} ===\n`);

  // 1) 健康检查
  const health = await call('GET', '/api/health');
  log(health.status === 200, `健康检查 /api/health -> ${health.status}`);

  // 2) 管理员登录
  const adminLogin = await call('POST', '/api/auth/login', { body: { username: 'admin', password: 'admin123' } });
  const adminCookie = extractToken(adminLogin.cookie);
  log(adminLogin.status === 200 && adminCookie, `管理员登录 admin/admin123 -> ${adminLogin.status}`);
  if (!adminCookie) { finish(); return; }

  // 3) 创建受访人（员工代表，供审核路径使用）
  const host = await call('POST', '/api/host-contacts', {
    body: { name: '员工代表', department: '测试部', phone: '13900000000' },
    cookie: adminCookie,
  });
  log(host.status === 201 || host.status === 200, `创建受访人 -> ${host.status}`);

  // 4) 模式一：员工预审单（直接 scheduled，无需审核）
  const empLogin = await call('POST', '/api/auth/login', { body: { username: 'employee', password: 'employee123' } });
  const empCookie = extractToken(empLogin.cookie);
  log(empLogin.status === 200 && empCookie, `员工登录 employee/employee123 -> ${empLogin.status}`);

  const appt = await call('POST', '/api/appointments', {
    cookie: empCookie,
    body: {
      visitorName: '测试访客A',
      visitorPhone: '13800000001',
      visitorType: 'CUSTOMER',
      visitObject: '员工代表',
      visitPurpose: '商务洽谈',
      appointmentDate: todayStr,
      appointmentTime: '09:00',
      visitorCount: 1,
      company: '测试公司',
    },
  });
  const apptId = appt.data?.id;
  log(appt.status === 201 && apptId, `模式一·创建预约(预审单) -> ${appt.status} id=${apptId}`);
  log(appt.data?.status === 'scheduled', `预约状态为 scheduled（员工创建直接通过）-> ${appt.data?.status}`);

  // 5) 门卫登录 + 查询 + 签到 + 签退
  const secLogin = await call('POST', '/api/auth/login', { body: { username: 'security', password: 'security123' } });
  const secCookie = extractToken(secLogin.cookie);
  log(secLogin.status === 200 && secCookie, `门卫登录 security/security123 -> ${secLogin.status}`);

  const guardList = await call('GET', '/api/security/appointments', { cookie: secCookie });
  const found = guardList.data?.data?.find((a) => a.visitorPhone === '13800000001');
  log(!!found, `门卫查询到该预约 -> ${found ? `#${found.id} status=${found.status}` : '未找到'}`);

  const checkIn = await call('POST', '/api/visit-records', { cookie: secCookie, body: { appointmentId: apptId } });
  const recordId = checkIn.data?.id;
  log(checkIn.status === 201 && recordId, `门卫签到 -> ${checkIn.status} recordId=${recordId} 通行牌=${checkIn.data?.passColor}`);

  const checkOut = await call('POST', '/api/visit-records/checkout', { cookie: secCookie, body: { visitRecordId: recordId } });
  log(checkOut.status === 200, `门卫签退 -> ${checkOut.status}`);

  // 6) 模式二：访客扫码预约（需被访人审核）
  const scan = await call('POST', '/api/scan-appointment', {
    body: {
      visitorName: '测试访客B',
      visitorPhone: '13800000002',
      visitorType: 'CUSTOMER',
      visitObject: '员工代表',
      visitPurpose: '技术交流',
      appointmentDate: todayStr,
      appointmentTime: '14:00',
      company: '访客公司',
    },
  });
  const scanId = scan.data?.appointment?.id;
  log(scan.status === 200 && scanId, `模式二·扫码预约 -> ${scan.status} id=${scanId}`);
  log(scan.data?.status === 'pending' || scan.data?.reviewEnabled === true, `扫码预约进入 pending（待审核）-> status=${scan.data?.status}`);

  // 7) 被访人（员工）审核通过
  const approve = await call('POST', '/api/appointments/approve', { cookie: empCookie, body: { appointmentId: scanId } });
  log(approve.status === 200, `被访人审核通过 -> ${approve.status}`);
  log(approve.data?.appointment?.status === 'scheduled', `审核后状态 scheduled -> ${approve.data?.appointment?.status}`);

  finish();
}

function finish() {
  console.log(`\n=== 结果：通过 ${pass} / 失败 ${fail} ===`);
  console.log(fail === 0 ? '🎉 冒烟测试全部通过，系统核心业务流在真实运行环境下可用。' : '⚠️ 存在失败项，请检查上方日志与应用日志。');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('冒烟测试异常：', e);
  process.exit(1);
});

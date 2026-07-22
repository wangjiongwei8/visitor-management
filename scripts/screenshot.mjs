// 自动截图脚本：把访客管理系统 3 个核心页面截图存入 docs/screenshots/
//
// 前置：先在本机把应用跑起来（任选一种）
//   Docker 一键：  cp .env.example .env.local && 编辑填 DATABASE_URL/TOKEN_SECRET && docker compose up -d
//   本地开发：    pnpm install && cp .env.example .env.local && pnpm dev
//
// 安装浏览器引擎（首次）：
//   pnpm add -D playwright && npx playwright install chromium
//
// 运行（应用起来后）：
//   BASE_URL=http://localhost:4000 node scripts/screenshot.mjs      # Docker
//   BASE_URL=http://localhost:3001 node scripts/screenshot.mjs      # 本地 dev
//
// 说明：首次启动应用会自动建表并创建默认账号（employee/employee123、security/security123），
//       脚本用这两个账号登录后分别进入「我的预约」与门卫页截图；公开扫码页无需登录。

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const OUT = join(__dirname, '..', 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

// 三个目标页面对应 README「界面预览与核心流程」的占位文件名
const shots = [
  { file: 'dual-mode-entry.png', login: null, path: '/public/appointment' },
  { file: 'host-review.png', login: { username: 'employee', password: 'employee123' }, path: '/my-appointments' },
  { file: 'guard-checkin.png', login: { username: 'security', password: 'security123' }, path: '/security' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

for (const s of shots) {
  if (s.login) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('#username', s.login.username);
    await page.fill('#password', s.login.password);
    await page.click('button[type="submit"]');
    // 等待登录跳转 / Cookie 生效
    await page.waitForTimeout(1500);
  }
  // 再显式进入目标页（兼顾登录后可能落在首页的情况）
  await page.goto(`${BASE_URL}${s.path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, s.file), fullPage: false });
  console.log('✅ saved', s.file);
}

await browser.close();
console.log('全部截图完成，存于 docs/screenshots/。下一步：把 README 里对应清单项改为 ![](' + 'docs/screenshots/<文件名>) 即可渲染。');

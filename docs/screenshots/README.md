# 界面截图存放目录

本目录用于存放 README「界面预览与核心流程」章节引用的真实界面截图。

## 计划补充的截图（对应 README 占位清单）

| 文件名 | 内容 |
|--------|------|
| `dual-mode-entry.png` | 员工后台「预审单」入口 + 访客扫码自助预约页（`/public/appointment`） |
| `host-review.png` | 被访人（员工）在「我的预约 / 待审核」中审批访客 |
| `guard-checkin.png` | 门卫搜索访客、黑名单拦截、按类型自动匹配通行牌颜色并签到 |

## 提交后如何生效

把图片放入本目录后，到 `README.md` 的「界面预览与核心流程」章节，将对应清单项改为：

```md
![双模式登记入口](docs/screenshots/dual-mode-entry.png)
```

即可在 GitHub 上正常渲染。

## 一键自动截图（推荐）

仓库内置 Playwright 脚本 `scripts/screenshot.mjs`，可自动登录并截取上述 3 张图：

```bash
# 1) 先把应用跑起来（Docker 或本地 dev 任选）
# 2) 安装浏览器引擎（首次）
pnpm add -D playwright && npx playwright install chromium
# 3) 运行（按实际端口调整 BASE_URL）
BASE_URL=http://localhost:4000 node scripts/screenshot.mjs   # Docker
# BASE_URL=http://localhost:3001 node scripts/screenshot.mjs # 本地 dev
```

脚本用默认账号 `employee/employee123`、`security/security123` 登录，公开扫码页 `/public/appointment` 无需登录。截图默认视口 1440×900。

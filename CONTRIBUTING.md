# 贡献指南（Contributing）

感谢你关注**访客管理系统（开源版）**！本项目是一个聚焦物理安全与门卫管理提效的企业访客出入管理系统的开源实现，采用 MIT 协议。欢迎以 Issue、PR 的形式参与贡献。

> 提 PR 前请先开 Issue 或 Discussion 讨论方案，尤其是涉及数据库结构、接口契约、权限模型的改动，避免返工。

---

## 一、技术栈与运行环境

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | 20 LTS | 开发 / 构建运行时 |
| pnpm | 9+ | **唯一支持的包管理器**（仓库通过 `only-allow` 强制，用 npm/yarn 会被拒绝） |
| PostgreSQL | 16 | 数据库（可用 Docker 一键起，见下文） |
| TypeScript | 5 | 全量类型 |

核心技术：Next.js 16（App Router）+ React 19 + Tailwind CSS 4 + Drizzle ORM + PostgreSQL + bcryptjs。

---

## 二、本地开发起步

```bash
# 1. 安装依赖（必须用 pnpm）
pnpm install

# 2. 准备环境变量
cp .env.example .env.local
#   编辑 .env.local，至少设置 DATABASE_URL 与 TOKEN_SECRET

# 3. 启动开发服务器
pnpm dev
#   访问 http://localhost:3001
```

数据库可选用 Docker 一键拉起：

```bash
docker compose up -d        # 同时起 PostgreSQL(postgres:16-alpine) 与应用
```

> ⚠️ **构建必须使用 webpack**：生产构建命令为 `pnpm build`（等价于 `next build --webpack`）。
> 不要改用 Turbopack——`bcryptjs` 与 Turbopack 不兼容，会导致认证模块报错。

---

## 三、项目结构

```
src/
├── app/                 # Next.js App Router：页面与 API 路由（app/api/*）
├── components/          # UI 组件（基于 Radix UI + shadcn 风格）
├── hooks/               # 前端自定义 Hooks
├── lib/                 # 业务工具库（auth、schema、version 等）
├── storage/
│   └── database/
│       └── shared/      # 唯一数据库 schema 定义源（Drizzle）
├── middleware.ts        # 路由中间件（认证/放行）
tests/
├── route/               # 接口层测试
└── unit/                # 单元测试
```

> 数据库表结构**只在 `src/storage/database/shared/schema.ts` 定义**（`src/lib/schema.ts` 仅做重导出）。新增表或字段请改此单一来源，勿在别处重复定义。

---

## 四、常用命令

| 命令 | 作用 |
|------|------|
| `pnpm dev` | 启动开发服务器（3001 端口） |
| `pnpm build` | 生产构建（webpack） |
| `pnpm start` | 以生产模式运行（4000 端口） |
| `pnpm lint` | ESLint 检查（CI 会跑） |
| `pnpm test` | 运行 Vitest 测试套件（27 项核心测试，CI 会跑） |
| `pnpm ts-check` | TypeScript 类型检查 |

提交前请确保 `pnpm lint` 与 `pnpm test` 本地通过。

---

## 五、代码规范

- **语言**：全量 TypeScript，提交前通过 `pnpm ts-check`。
- **风格**：ESLint 配置见 `eslint.config.mjs`，用 `pnpm lint` 自查；保持与现有代码一致的缩进与命名。
- **提交信息**：推荐 [Conventional Commits](https://www.conventionalcommits.org/) 风格，例如：
  - `feat: 新增门卫批量签退`
  - `fix: 修正二维码扫码后受访人匹配为空`
  - `docs: 补充部署说明`
  - `refactor: 抽离签到逻辑到 services 层`
- **数据库变更**：通过 Drizzle 管理，修改 `shared/schema.ts` 后必要时同步 `drizzle.config.ts`；不要手写原始 `ALTER TABLE` 散落各处。

---

## 六、提交 Pull Request 流程

1. **Fork** 本仓库到你的账号，或基于 `main` 新建特性分支（`feat/xxx`、`fix/xxx`）。
2. 在本地完成开发与自测（`pnpm lint` + `pnpm test` 全绿）。
3. 推送到你的分支，在 GitHub 发起 PR 到本仓库的 `main`。
4. **CI 自动运行**：每次 push / PR 会触发 `.github/workflows/ci.yml`，自动跑 lint + 测试。请等徽章变绿后再请求 review。
5. PR 描述请包含：
   - 背景 / 解决的问题
   - 改动范围（前端 / 后端 / 文档 / 配置）
   - 如何自测（步骤或截图）
   - 是否涉及数据库结构变更（如有，说明迁移方式）

---

## 七、安全与敏感信息

- **绝不提交密钥**：`TOKEN_SECRET`、数据库密码等只存在于本地 `.env.local`（已被 `.gitignore` 忽略），不要写进代码或提交。
- 不要提交客户专属信息（真实 IP、域名、账号密码、Token）。
- 发现安全漏洞请**私有渠道**联系维护者，不要在公开 Issue 暴露细节。

---

## 八、行为准则

请友善、尊重地交流。我们欢迎建设性讨论，拒绝人身攻击与骚扰。

---

再次感谢你的贡献！🎉

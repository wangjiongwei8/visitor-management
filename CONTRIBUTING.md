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

## 二、快速开始

### 方式一：Docker 一键启动（最省事，推荐先体验）

1. **前置条件**：本机已安装 Docker / Docker Desktop（含 `docker compose`）。
2. **准备环境变量**：
   ```bash
   cp .env.example .env.local
   ```
   打开 `.env.local`，把 `TOKEN_SECRET` 改成一段足够长的随机串（生成：`openssl rand -hex 32`）。`DATABASE_URL` 用默认值即可。
3. **一条命令拉起数据库 + 应用**：
   ```bash
   docker compose up -d
   ```
   该命令会同时启动 PostgreSQL（`postgres:16-alpine`）与应用容器，应用每 30s 探测 `/api/health` 做健康检查。
4. **浏览器访问** `http://localhost:4000`，按引导完成首次初始化、设置管理员密码。
5. **用默认账号登录**（首次登录强制要求改密）：

   | 角色 | 用户名 | 初始密码 |
   |------|--------|----------|
   | 管理员 | `admin` | `admin123` |
   | 门卫 | `security` | `security123` |
   | 员工 | `employee` | `employee123` |
   | 访客 | `visitor` | `visitor123`（访客实际无需登录，扫码即可预约） |

6. **验证**：访问 `http://localhost:4000/api/health`，返回 HTTP 200 即表示应用与数据库连接正常。

### 方式二：本地源码开发（改代码、提 PR 用）

1. **前置条件**：Node.js 20 LTS、pnpm 9+、本地 PostgreSQL 16（没有的话可用 Docker 只起数据库，见步骤 4）。
2. **安装依赖**（**必须用 pnpm**，用 npm / yarn 会被仓库的 `only-allow` 强制拒绝）：
   ```bash
   pnpm install
   ```
3. **准备环境变量**：
   ```bash
   cp .env.example .env.local
   ```
   编辑 `.env.local` 至少设置：
   - `DATABASE_URL`：指向你的 PostgreSQL，例如 `postgresql://postgres:password@localhost:5432/visitor_management`
   - `TOKEN_SECRET`：长随机串（见方式一的生成命令）
   - `NODE_ENV`：本地开发保持 `development`
4. **（可选）只起数据库**：若本机没装 PostgreSQL，可只拉起 PG 容器：
   ```bash
   docker compose up -d db
   ```
5. **启动开发服务器**：
   ```bash
   pnpm dev
   ```
   访问 `http://localhost:3001`。
6. **改完代码、提 PR 前**，本地先跑质量闸门：
   ```bash
   pnpm lint      # ESLint 检查
   pnpm test      # Vitest 测试套件（27 项）
   ```
   两者全绿后再提交。

### ⚠️ 关键注意事项

- **构建必须用 webpack**：生产构建命令为 `pnpm build`（等价于 `next build --webpack`）。**不要用 Turbopack**——`bcryptjs` 与其不兼容，会导致认证模块报错。
- **数据库表结构自动同步**：数据库名默认 `visitor_management`，表结构由 Drizzle 在首次运行时自动创建，无需手动建表。
- **Node 版本**：开发 / CI / 镜像基准均为 Node 20 LTS；用 22 也可运行，但建议保持与 CI 一致。
- 维护 `pnpm-lock.yaml`，提交依赖变更时确保它与 `package.json` 同步。

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

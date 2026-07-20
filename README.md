# 访客管理系统 V2（开源版）

企业访客管理系统开源版。访客**扫固定二维码自助预约**，被访人（员工）**后台审核**（可开关），门卫**搜索签到发牌**，全流程脱离对特定客户网络的绑定，任何组织可自行部署。

> V1 仅在客户内网免费使用、不开源；本仓库为基于 V1 升级的独立开源版本（MIT）。

---

## 🌟 为什么选它

传统访客管理要么靠纸质登记本、要么靠前台电话反复确认，既低效又难追溯，还常踩数据合规红线。本系统用「二维码 + 审核 + 自托管」把这套流程彻底线上化：

- **访客零门槛**：扫固定二维码自助填表，无需注册登录，出差 / 外部人员也能用
- **可控的审核**：被访人本人审核（开关可关，关即自动通过），谁来的、谁放的清清楚楚
- **数据不出企业**：完全自托管，部署在你自己的服务器，访客信息不落第三方
- **零外部依赖**：不需要买邮件 / 短信服务，跑起来没有额外月费
- **能力完整**：黑名单拦截、长约车辆 / 人员、用户与密码策略、操作日志、访客看板一应俱全
- **部署简单**：Docker 一条命令起，或本地 `pnpm dev`，几分钟可用

**适用场景**：工厂 / 园区 / 写字楼 / 政府单位 / 学校 / 医院等有访客登记与安全管理需求的任何组织。

## ✨ 功能特性

- **扫码自助预约**：固定通用二维码，访客手机扫码填表，无需登录
- **审核开关**：管理员可开启/关闭审核；开启后由**被访人本人**审核，关闭则自动通过
- **被访人匹配**：受访人必须从系统清单下拉选定，未匹配则硬阻止提交
- **门卫签到签退**：手机号 / 姓名 / 车牌 / 访客编号搜索，黑名单自动拦截，按类型自动匹配通行牌颜色
- **完整保留 V1 能力**：黑名单、长约车辆/人员管理、用户管理（批量导入）、操作日志、访客看板、受访人清单、密码策略、预约管理、访客编号自动生成
- **零外部依赖**：无需邮件/短信服务即可运行

---

## 🚀 快速开始

### 方式一：Docker 一键部署（推荐）

```bash
cp .env.example .env.local
# 编辑 .env.local，设置 DATABASE_URL 与 TOKEN_SECRET（TOKEN_SECRET 务必改为长随机串）
docker compose up -d
# 访问 http://localhost:4000
```

### 方式二：本地开发

```bash
pnpm install
cp .env.example .env.local   # 填写数据库连接与 TOKEN_SECRET
pnpm dev                     # http://localhost:3001
```

### 运行测试

```bash
pnpm test                    # Vitest，27 项核心测试
```

### 生产构建

```bash
pnpm build                   # 即 next build --webpack（必须用 webpack，Turbopack 不兼容 bcryptjs）
```

---

## ⚙️ 配置说明

所有可配置项见 `.env.example`：

| 变量 | 说明 | 必填 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 | ✅ |
| `TOKEN_SECRET` | Token 签名密钥（生产必须覆盖默认值） | ✅ |
| `NODE_ENV` | `development` / `production` | ✅ |
| `DB_PASSWORD` | 仅 Docker 部署时用于初始化数据库 | Docker 用 |

> 🔒 源码中**不含**任何客户专属密钥。密钥仅存在于本地 `.env.local` / `.env.production`，已被 `.gitignore` 忽略。

---

## 📁 目录结构（节选）

```
src/
├── app/
│   ├── api/settings/public/   # 免认证：返回审核开关状态
│   ├── public/appointment/    # 访客扫码自助预约页
│   ├── my-appointments/       # 员工端（含「待审核」Tab）
│   ├── admin/                 # 管理端（审核开关、用户、黑名单、长约…）
│   └── security/              # 门卫端
├── components/visitor/        # host-contact-search 等
├── lib/review-status.ts       # 审核状态纯函数
└── storage/database/shared/schema.ts  # Drizzle 表定义
tests/                         # Vitest 测试套件
docs/                          # PRD / 架构 / 设计总览
```

---

## 📚 文档

- [部署说明](docs/部署说明.md) — Docker / 本地部署、环境变量、初始化、备份升级
- [操作说明书](docs/操作说明书.md) — 访客 / 被访人 / 门卫 / 管理员分角色操作指引
- [V2 设计总览](docs/V2-开源版总览.md) — 入口说明（与 V1 差异、流程、决策）
- [产品需求文档](docs/PRD-V2-访客管理系统.md)
- [架构设计](docs/ARCHITECTURE-V2.md)

---

## 🧪 质量

- 单元测试 / 路由测试：**27 / 27 通过**（Vitest）
- 生产构建：`next build --webpack` **通过**
- 源码静态审查：0 已知 Bug

---

## 📄 许可证

[MIT](LICENSE) — 可自由用于商业与非商业用途。

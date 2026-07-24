> 🇺🇸 English | 🇨🇳 [中文](CONTRIBUTING.zh-CN.md)

# Contributing Guide

Thank you for your interest in the **Visitor Management System (Open Source)**! This project is an open-source implementation of an enterprise visitor access management system focused on physical security and guard-efficiency improvements, released under the MIT License. Contributions via Issues and PRs are welcome.

> Please open an Issue or Discussion to discuss your approach **before** submitting a PR — especially changes touching the database schema, API contracts, or the permission model — to avoid rework.

---

## 1. Tech Stack & Runtime

| Component | Version | Notes |
|------|----------|------|
| Node.js | 20 LTS | Runtime for development / build |
| pnpm | 9+ | **The only supported package manager** (enforced via `only-allow`; npm/yarn are rejected) |
| PostgreSQL | 16 | Database (can be started with one Docker command, see below) |
| TypeScript | 5 | Fully typed |

Core tech: Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + Drizzle ORM + PostgreSQL + bcryptjs.

---

## 2. Quick Start

> **About database initialization**: at app startup (`instrumentation.ts`) two things run automatically — ① if `drizzle-kit` is present in the environment, the table schema is synced to the database; ② default accounts (admin/security/employee/visitor) and system settings are created idempotently. A fresh deployment therefore works out of the box with no manual initialization. If auto table creation does not take effect (e.g. the standalone image lacks drizzle-kit), run `pnpm db:push` once before starting.

### Option 1: Docker One-Command Start (easiest, recommended for first try)

1. **Prerequisites**: Docker / Docker Desktop (with `docker compose`) installed locally.
2. **Prepare environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and change `TOKEN_SECRET` to a sufficiently long random string (generate with: `openssl rand -hex 32`). The default `DATABASE_URL` is fine.
3. **Start database + app with one command**:
   ```bash
   docker compose up -d
   ```
   This starts both the PostgreSQL (`postgres:16-alpine`) and the app containers; the app probes `/api/health` for a health check every 30s.
4. **Open in browser** `http://localhost:4000` and follow the prompts to complete first-time initialization and set the admin password.
5. **Log in with the default accounts** (changing the password is forced on first login):

   | Role | Username | Initial password |
   |------|--------|----------|
   | Admin | `admin` | `admin123` |
   | Guard | `security` | `security123` |
   | Employee | `employee` | `employee123` |
   | Visitor | `visitor` | `visitor123` (visitors don't actually need to log in; they self-register by scanning) |

6. **Verify**: visit `http://localhost:4000/api/health`; an HTTP 200 response means the app and database are connected normally.

### Option 2: Local Source Development (for code changes & PRs)

1. **Prerequisites**: Node.js 20 LTS, pnpm 9+, local PostgreSQL 16 (or use Docker to start only the database, see step 4).
2. **Install dependencies** (**must use pnpm**; npm / yarn are rejected by the repo's `only-allow`):
   ```bash
   pnpm install
   ```
3. **Prepare environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and set at least:
   - `DATABASE_URL`: point to your PostgreSQL, e.g. `postgresql://postgres:password@localhost:5432/visitor_management`
   - `TOKEN_SECRET`: a long random string (see the generation command in Option 1)
   - `NODE_ENV`: keep `development` for local dev
4. **(Optional) Start only the database**: if PostgreSQL isn't installed locally, start just the PG container:
   ```bash
   docker compose up -d db
   ```
5. **Start the dev server**:
   ```bash
   pnpm dev
   ```
   Visit `http://localhost:3001`.
6. **Before submitting a PR**, run the local quality gates:
   ```bash
   pnpm lint      # ESLint check
   pnpm test      # Vitest test suite (27 tests)
   ```
   Submit only after both are green.

### ⚠️ Key Notes

- **Build must use webpack**: the production build command is `pnpm build` (equivalent to `next build --webpack`). **Do not use Turbopack** — `bcryptjs` is incompatible with it and will break the auth module.
- **DB schema auto-sync**: the default database name is `visitor_management`; the schema is created automatically by Drizzle on first run — no manual table creation needed.
- **Node version**: development / CI / image base all use Node 20 LTS; 22 also works but keep it consistent with CI.
- Maintain `pnpm-lock.yaml`; when committing dependency changes, keep it in sync with `package.json`.

---

## 3. Project Structure

```
src/
├── app/                 # Next.js App Router: pages and API routes (app/api/*)
├── components/          # UI components (Radix UI + shadcn style)
├── hooks/               # Frontend custom Hooks
├── lib/                 # Business utility libraries (auth, schema, version, etc.)
├── storage/
│   └── database/
│       └── shared/      # Single source of truth for the DB schema (Drizzle)
├── middleware.ts        # Route middleware (auth / pass-through)
tests/
├── route/               # API-layer tests
└── unit/                # Unit tests
```

> The database schema is defined **only in `src/storage/database/shared/schema.ts`** (`src/lib/schema.ts` merely re-exports). Add new tables or columns only in this single source — do not duplicate definitions elsewhere.

---

## 4. Common Commands

| Command | Purpose |
|------|------|
| `pnpm dev` | Start dev server (port 3001) |
| `pnpm build` | Production build (webpack) |
| `pnpm start` | Run in production mode (port 4000) |
| `pnpm lint` | ESLint check (runs in CI) |
| `pnpm test` | Run Vitest test suite (27 core tests, runs in CI) |
| `pnpm ts-check` | TypeScript type check |

Make sure `pnpm lint` and `pnpm test` pass locally before committing.

---

## 5. Code Style

- **Language**: fully typed TypeScript; pass `pnpm ts-check` before committing.
- **Style**: ESLint config is in `eslint.config.mjs`; self-check with `pnpm lint`; keep indentation and naming consistent with existing code.
- **Commit messages**: [Conventional Commits](https://www.conventionalcommits.org/) style is recommended, e.g.:
  - `feat: add guard bulk check-out`
  - `fix: correct empty host match after QR scan`
  - `docs: supplement deployment guide`
  - `refactor: extract check-in logic into services layer`
- **DB changes**: managed via Drizzle; after editing `shared/schema.ts`, sync `drizzle.config.ts` when needed; don't scatter hand-written `ALTER TABLE` statements around.

---

## 6. Pull Request Workflow

1. **Fork** the repo to your account, or create a feature branch off `main` (`feat/xxx`, `fix/xxx`).
2. Complete development and self-testing locally (`pnpm lint` + `pnpm test` both green).
3. Push to your branch and open a PR to this repo's `main` on GitHub.
4. **CI runs automatically**: every push / PR triggers `.github/workflows/ci.yml`, which runs lint + tests. Wait for the badge to turn green before requesting review.
5. The PR description should include:
   - Background / problem being solved
   - Scope of changes (frontend / backend / docs / config)
   - How to self-test (steps or screenshots)
   - Whether it involves DB schema changes (if so, describe the migration approach)

---

## 7. Security & Sensitive Information

- **Never commit secrets**: `TOKEN_SECRET`, database passwords, etc. exist only in local `.env.local` (ignored by `.gitignore`); don't write them into code or commit them.
- Don't commit customer-specific information (real IPs, domains, account passwords, tokens).
- Report security vulnerabilities through **private channels** to the maintainers; don't expose details in public Issues.

---

## 8. Code of Conduct

Communicate kindly and respectfully. We welcome constructive discussion and reject personal attacks and harassment.

---

Thank you again for your contribution! 🎉

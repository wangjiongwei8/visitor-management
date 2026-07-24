> 🇺🇸 English | 🇨🇳 [中文](PRD-访客管理系统.zh-CN.md)

# Visitor Management System (Open Source) — Product Requirements Document (PRD)

## Project Information

| Item | Content |
|------|------|
| Language | English |
| Tech stack | Next.js 16 (App Router) + TypeScript + Tailwind CSS + Drizzle ORM + PostgreSQL |
| Project code | visitor-management |
| Doc version | v1.0.0 |
| Created | 2025-07-10 |
| Based on version | v1.0.0 |
| Release mode | Open Source (GitHub) |

### Original Requirement Recap

Released as an independent open-source project. Provides two parallel registration modes: Mode 1 (Pre-registration) where an employee fills the visit appointment on behalf of the visitor in the internal backend and it auto-approves on submission; Mode 2 (scan registration) where the visitor scans a fixed QR code on-site to self-register and the host reviews in person (toggleable). The core change moves "admin unified approval" to "host reviews in person", while fully retaining all existing system features.

---

## Product Definition

### Product Goals

1. **Visitor self-service**: visitors self-register via a fixed QR code, removing the dependency on employees operating inside the customer's intranet, and supporting travel / field scenarios.
2. **Flexible review**: a review toggle — off means auto-approve, on means the host reviews in person — adapting to different security levels.
3. **Open source & reusable**: released as an independent open-source project that any organization can deploy and use, with clear code structure, complete docs, and easy secondary development.
4. **Dual-mode registration**: supports both employee-filled pre-registration and visitor scan self-service, covering different network and reception scenarios, with a shared guard check-in flow.

### User Stories

| ID | Scenario |
|------|------|
| US-01 | As a visitor, I want to scan a fixed QR code to fill in appointment info without downloading an app or logging in, so I can quickly complete a factory-entry appointment. |
| US-02 | As a host (employee), I want to see a "who wants to visit me" pending-review list in the backend and one-click approve or reject (with reason), so I can control visits myself. |
| US-03 | As a guard, I want to quickly find the appointment record by phone / name / plate / visitor code and complete check-in, with the system auto-blocking blacklisted people, so I can release them efficiently and safely. |
| US-04 | As an admin, I want a review toggle to control whether the host review flow is enabled, so I can simplify the flow in low-risk periods and tighten control in high-risk periods. |
| US-05 | As a visitor, when the host name I enter doesn't match the system list, I want a prompt to confirm, so I don't fill it wrong and get stuck in review. |
| US-06 | As an employee (host), I want to fill the visit appointment on behalf of the visitor in the internal backend (pre-registration) that auto-approves on submission, so the visitor can arrive without scanning and be checked in directly by the guard. |

---

## Technical Spec

### Feature Change Overview

| Module | Change type | Description |
|------|----------|------|
| Fixed universal QR code | 🆕 New | One fixed QR code; all visitors scan to enter the self-service form |
| Review toggle | 🆕 New | Admin can enable/disable review |
| Host review | 🔄 Modified | Approver changed from "admin" to "host in person" |
| Host matching | 🆕 New | Visitor's host is matched against the host_contacts list when filling |
| Visitor self-registration | 🔄 Modified | Entry moved from employee intranet op to visitor scan self-service |
| Pre-registration (employee-filled) | 🆕 New | Employee fills visit appointment in internal backend; auto-approves on submit (scheduled); parallel to Mode 1 and scan mode |
| Blacklist management | ✅ Kept | Auto-intercept at check-in; permanent / temporary blacklist |
| Long-term vehicles/personnel | ✅ Kept | Approval, check-in, on-site status, codes |
| Guard check-in/out | ✅ Kept | Search → check-in → badge → check-out |
| User management | ✅ Kept | CRUD, bulk import |
| Operation logs | ✅ Kept | Full operation records |
| Visitor dashboard | ✅ Kept | Stat cards + charts + filters |
| Host list | ✅ Kept | host_contacts management |
| Password policy | ✅ Kept | Password complexity management |
| Appointment management | ✅ Kept | Query / modify / export |
| Auto visitor code | ✅ Kept | visitorCode auto-generated |
| Email notification | ❌ Removed | Not needed |
| SMS notification | ❌ Not needed | Never supported |
| Visitor badge printing | ❌ Removed | Printing not needed for now |

### Requirement Pool

#### P0 — Must-have (core flow; system unusable without any)

| ID | Requirement | Module | Change type |
|------|------|----------|-------|
| P0-01 | Fixed universal QR code: generate a QR code with a fixed URL, posted at the guard post / factory; visitors scan to enter the self-service form, no login | Appointment entry | 🆕 New |
| P0-02 | Visitor self-registration form: mobile-adapted, supports selecting visitor type (Customer/Supplier/Applicant/Delivery/Government/Tour Visitor), fills visitor info, host, visit purpose, appointment time, companions, vehicle info | Visitor appointment | 🔄 Modified |
| P0-03 | Host matching: when the visitor fills the host, the system matches in real time against the host_contacts list; on success continue submit, on failure show a confirmation prompt | Visitor appointment | 🆕 New |
| P0-04 | Review toggle: admin can enable/disable review in system settings; off → visitor submit auto `scheduled`; on → `pending` pending review | System settings | 🆕 New |
| P0-05 | Host review list: after login the employee sees a "Pending Review" list showing only appointments where they are the host; supports "Approve" and "Reject (with reason required)" | Appointment review | 🔄 Modified |
| P0-06 | Guard check-in: search appointments by phone / name / plate / visitor code, confirm identity then check in, auto-match badge color by visitor type, auto blacklist interception | Guard check-in | ✅ Kept |
| P0-07 | Guard check-out: search on-site visitors, confirm check-out, collect badge, record check-out time | Guard check-out | ✅ Kept |
| P0-08 | User auth & RBAC: login by employee ID, roles (Admin/Guard/Employee) with distinct permissions, visitors need no login | User auth | ✅ Kept |
| P0-09 | Pre-registration creation: employee fills visit appointment in backend (My Appointments / Appointment Management) on behalf of visitor, host defaults to self, auto-approves on submit (scheduled), no review, parallel to Mode 1 and scan mode | Appointment entry | 🆕 New |

#### P1 — Should-have (important but non-blocking)

| ID | Requirement | Module | Change type |
|------|------|----------|-------|
| P1-01 | Blacklist management: add/remove blacklist (name, ID, phone, reason), permanent / temporary (auto-release on expiry), auto-intercept at check-in | Blacklist | ✅ Kept |
| P1-02 | Long-term vehicles/personnel: add/edit/delete/enable/disable, validity management, on-site status view, code management | Long-term vehicles | ✅ Kept |
| P1-03 | User management: CRUD, bulk import (CSV template: role, employee ID, name, department), default password policy, duplicate employee-ID detection | User management | ✅ Kept |
| P1-04 | Operation logs: record all key operations (operator, type, module, description, time, IP), multi-dimensional filtering | Operation logs | ✅ Kept |
| P1-05 | Appointment management: query (filter by time/status/visitor type, etc.), view details, modify, export (CSV/Excel) | Appointment management | ✅ Kept |
| P1-06 | Auto visitor code: visitorCode generated by rule, usable at check-in/query | Visitor management | ✅ Kept |
| P1-07 | Host list management (host_contacts): admin maintains host info for visitor form matching | System settings | ✅ Kept |
| P1-08 | Reject-reason recording & display: host fills reason on reject, viewable in appointment details | Appointment review | 🆕 New |

#### P2 — Could-have (experience polish)

| ID | Requirement | Module | Change type |
|------|------|----------|-------|
| P2-01 | Visitor dashboard: stat cards (total/check-in/on-site, etc.) + charts (purpose distribution / type distribution / trend), time-range and host filtering | Visitor dashboard | ✅ Kept |
| P2-02 | QR code management page: download QR image, print poster (with instructions), copy appointment link | System settings | 🔄 Adapt |
| P2-03 | Password policy management: admin configures password complexity, validity, etc. | System settings | ✅ Kept |
| P2-04 | Sensitive data masking: visitor name, phone, ID masked in lists and details | Visitor management | ✅ Kept |
| P2-05 | Data export: appointment and visitor records exportable | Data management | ✅ Kept |

### UI Design Notes

#### 1. Fixed QR Code + Visitor Self-Registration (core new flow)

```
┌──────────────────────────────────────────┐
│          厂区入口 / 门卫处                  │
│  ┌────────────────────────────┐           │
│  │    📱 访客预约              │           │
│  │                            │           │
│  │  [ 固定通用二维码 ]         │           │
│  │                            │           │
│  │  微信/浏览器扫码即可预约     │           │
│  └────────────────────────────┘           │
└──────────────────────────────────────────┘

扫码后 → 移动端预约表单：
┌──────────────────────────────────┐
│        访客预约登记                │
│                                  │
│  访客类型: [下拉选择]             │
│  姓名: [____]  电话: [____]      │
│  身份证号: [____] (选填)          │
│  公司/单位: [____]               │
│  受访人: [____] ← 实时匹配 host   │
│  来访事由: [____]               │
│  预约日期: [📅]                 │
│  入场时间: [🕐]  离场时间: [🕐]  │
│  ── 随行人员 ──                  │
│  + 添加随行人员                   │
│  ── 车辆信息 ──                  │
│  车牌号: [____]                 │
│                                  │
│  是否就餐: ☐ 是                  │
│                                  │
│  [ 提交预约 ]                    │
└──────────────────────────────────┘
```

#### 2. Host Review List (employee console)

```
┌──────────────────────────────────────────┐
│  待审核预约                                │
│  ┌────────────────────────────────────┐   │
│  │ 访客: 张三  电话: 138****8888      │   │
│  │ 类型: 客户  来访事由: 项目洽谈      │   │
│  │ 预约时间: 2025-07-15 09:00-17:00   │   │
│  │                                    │   │
│  │ [通过] [拒绝]                       │   │
│  └────────────────────────────────────┘   │
│  （拒绝时弹出理由输入框）                   │
└──────────────────────────────────────────┘
```

#### 3. Review Toggle (admin system settings)

```
┌──────────────────────────────────────────┐
│  系统设置 > 审核配置                       │
│                                          │
│  访客预约审核:  [ 🔘 开启 / ⚪ 关闭 ]       │
│                                          │
│  开启后：访客提交 → 被访人审核 → 通过/拒绝  │
│  关闭后：访客提交 → 自动通过(scheduled)     │
└──────────────────────────────────────────┘
```

#### 4. Guard Check-in Page (keep original layout)

```
┌──────────────────────────────────────────┐
│  访客签到                                  │
│                                          │
│  搜索: [手机号/姓名/车牌号/访客编号]  [搜索] │
│  ─────────────────────────────────────── │
│  搜索结果：                                │
│  ┌────────────────────────────────────┐  │
│  │ 预约编号: VM20250715001             │  │
│  │ 访客: 张*  电话: 138****8888       │  │
│  │ 受访人: 李四  公司: XX科技          │  │
│  │ 访客类型: 客户  通行牌: 🟢 绿色    │  │
│  │                                    │  │
│  │ [确认签到]                          │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ⚠ 黑名单拦截提示（红色醒目）              │
└──────────────────────────────────────────┘
```

#### 5. Pre-registration Creation (employee console, Mode 1)

```
┌──────────────────────────────────────────┐
│  新建预审单（员工端）                       │
│                                          │
│  访客姓名: [____]  电话: [____]          │
│  身份证号: [____] (选填)                  │
│  公司/单位: [____]                       │
│  受访人: 本人（默认，不可改填他人）         │
│  来访事由: [____]                       │
│  预约日期: [📅]  入场: [🕐] 离场: [🕐]    │
│  + 随行人员   车牌号: [____]             │
│  是否就餐: ☐ 是                          │
│                                          │
│  [ 提交预审单 ]                          │
└──────────────────────────────────────────┘
提交后状态: scheduled（自动通过，无需审核）
```

### Appointment Status Flow

```
                  审核关闭
访客提交 ──────────────────────────→ scheduled
                                         │
                  审核开启                │
访客提交 → pending → 被访人审核 ──通过──→ scheduled
                         │                │
                         └──拒绝──→ rejected
                                          │
              scheduled ──→ checked_in ──→ checked_out
                            (门卫签到)     (门卫签退)
```

> Mode 1 (Pre-registration) is created by an employee (`createdBy = employee`); on submit it is `scheduled`, bypassing `pending` / host review; the guard can check in directly on arrival.

### Open Questions

| ID | Question | Impact |
|------|------|----------|
| Q-01 | Should the visitor code (visitorCode) generation rule reuse the existing rule, or be adjusted to a more semantic format? | P0-06 Guard check-in |
| Q-02 | Do companions each need a matched badge color, or only the primary visitor? | P0-06 Guard check-in |
| Q-03 | During host review, is a "review note" needed (optional on approve, required on reject), or only on reject? | P0-05 Host review |
| Q-04 | Review timeout: if the host never reviews, does the appointment auto-expire? For how long? | P0-05 Host review |
| Q-05 | Is the fixed QR code URL `/appointment` (reuse existing) or a shorter path? | P0-01 QR code |
| Q-06 | Does the employee console keep the ability to create appointments for visitors, or only visitor self-scan? | P0-02 / P0-09 | **Confirmed: keep (dual mode).** The employee console keeps pre-registration creation, parallel to visitor scan; both modes share guard check-in |
| Q-07 | License type for the open-source version? Need CONTRIBUTING.md / CODE_OF_CONDUCT? | Project release |

---

## Feature Module List

The following feature modules are fully retained in this system, with only necessary adaptations (e.g. tech-stack upgrade, API path adjustment):

| Module | Status | Adaptation notes |
|---------|---------|----------|
| User auth (login / RBAC) | ✅ Kept | No change |
| Blacklist management | ✅ Kept | No change |
| Long-term vehicles/personnel | ✅ Kept | No change |
| User management (bulk import) | ✅ Kept | No change |
| Operation logs | ✅ Kept | Added review-related log types |
| Visitor dashboard | ✅ Kept | Chart data source adapted to new status fields |
| Host list (host_contacts) | ✅ Kept | Added matching query API |
| Password policy management | ✅ Kept | No change |
| Guard check-in/out | ✅ Kept | Badge color logic unchanged |
| Appointment management (query/export) | ✅ Kept | Added reviewer field filter |
| Auto visitor code | ✅ Kept | No change |
| Sensitive data masking | ✅ Kept | No change |

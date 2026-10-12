<div align="center">

# 🧵 Work Study Process Automation

### Digitizing the Industrial Engineering workflow for garment manufacturing — from order to skill matrix, across multiple factories.

[![Status](https://img.shields.io/badge/status-in%20planning-blue?style=for-the-badge)](#-roadmap)
[![Version](https://img.shields.io/badge/SRS-v0.2-success?style=for-the-badge)](#-documentation)
[![License](https://img.shields.io/badge/license-TBD-lightgrey?style=for-the-badge)](#-license)

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

</div>

---

## 📖 Overview

**Work Study Process Automation** replaces the Industrial Engineering (Work Study) department's manual Excel templates with a single, connected, **multi-factory web application**. It takes a style from order intake all the way to the operator skill matrix — with every engineering value **auto-calculated** and nothing re-keyed between modules.

Built for **three factories — AGL · AJL · ABM** — users log in, land on their assigned factory dashboard, and drive each style through a **guided 10-step workflow** with role-based approval gates.

> 🎯 **The core idea:** the Operation Breakdown is the engine. SMV + the operation list drive the pitch time, targets, line balancing, cycle-time control limits, and efficiency — automatically.

---

## ✨ Key Features

- 🏭 **Multi-factory** — scoped data and dashboards for AGL, AJL & ABM
- 🔐 **Secure login & RBAC** — users auto-routed to their assigned factory; role-based access throughout
- 🧭 **Guided 10-step workflow** — mirrors the official Work Study Process Flow Chart
- ⚙️ **Auto-calculation engine** — SMV, TML, pitch time, targets, UCL/LCL, performance & productivity gap
- ✅ **Approval gates** — OB Approval and Layout Verification enforced by role
- 🕓 **OB versioning** — every change keeps an immutable copy of the original
- 📐 **Automatic line balancing** — one OB → many layouts (U-shape / I-shape) + balancing graph
- ⏱️ **Cycle time studies** — up to 5 timed rounds (Non-Balance → Balance → Re-Balance), with NNVA handling
- 🧮 **Skill matrix** — auto-collected machine capability, process expertise & efficiency over time
- 📊 **Live charts** — line-balancing and cycle-time capacity graphs
- 📥 **Excel import/export** — seed from and export to the existing factory formats
- 🔌 **Integration-ready** — a stable, versioned API so other apps can consume the data

---

## 🧭 The 10-Step Workflow

| # | Step | 👤 Responsible | 🔎 Notes |
|:---:|---|---|---|
| 1️⃣ | Get Order Details | Planning Board | Order intake |
| 2️⃣ | Collect Approved Sample | Production Co-ordinator | Reference + photos |
| 3️⃣ | Make Operation Breakdown | **WSE** | Select from master DB · auto-calc SMV/TML/targets |
| 4️⃣ | 🚦 **Approval of OB** | **Asst. Mgr. (Central)** | Gate · read/write all factories |
| 5️⃣ | Make Line Layout | **WSE** | From Approved OB · auto-balancing |
| 6️⃣ | 🚦 **Layout Verification** | **Sr. Exec. / Asst. Mgr. / Mgr.** | Gate · modify sequence only |
| 7️⃣ | Production Buildup Plan | — | *Sub-process (lower priority)* |
| 8️⃣ | Change Over Time | — | *Sub-process (lower priority)* |
| 9️⃣ | Cycle Time (1st–5th) | **WSE** | UCL/LCL · performance · NNVA |
| 🔟 | Skill Matrix | **WSE** | Auto-collected · date-range + print |

> 🚦 **Gates:** Layout (5) requires an **Approved OB** (4); Cycle Time (9) requires a **Verified Layout** (6). Adding a new process after verification requires a **new OB + re-approval**.

```
Login ─▶ 🏭 Factory Dashboard ─▶ 1️⃣→2️⃣→3️⃣→🚦4️⃣→5️⃣→🚦6️⃣→7️⃣→8️⃣→9️⃣→🔟
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| 🎨 **Frontend** | React 18 · Vite · TypeScript · Tailwind CSS |
| 🔁 **State / Data** | TanStack Query · Zustand · React Hook Form + Zod |
| 📊 **Charts** | Recharts |
| 🧮 **Engine** | Shared TypeScript calculation module |
| 🚀 **Backend** | Node.js 20 · NestJS (REST / OpenAPI) |
| 🗄️ **Database** | PostgreSQL 16 · Prisma ORM |
| 🔐 **Auth** | JWT (access + refresh) · bcrypt · RBAC |
| 📑 **Excel I/O** | SheetJS · ExcelJS |
| 🔌 **Integration** | OpenAPI · API keys / OAuth2 client-credentials · read-only views · webhooks |
| 🧪 **Testing** | Vitest · Playwright |
| 📦 **DevOps** | Docker Compose · GitHub CI · Nginx/Caddy (HTTPS) |

---

## 🧮 Calculation Engine (core formulas)

| Value | Formula |
|---|---|
| Total SMV | `Machine SMV + Manual SMV` |
| Pitch Time | `Total SMV ÷ worker count` |
| TML | `SMV ÷ Pitch Time` |
| Target Per Hour | `(60 ÷ SMV) × AML` |
| 100% Target/hr | `(Manpower × 60) ÷ Total SMV` |
| Worker Potential pcs/hr | `60 ÷ Bpt` |
| Productivity Gap % | `1 − (Current ÷ Potential)` |

> 📝 Formulas are reverse-engineered from the existing Excel files and will be confirmed against the IE team's authoritative list. All guard against division-by-zero (no `#DIV/0!`).

---

## 🔌 Built for Integration

This system is a **source of data for other applications**. Consumers read through a **stable, versioned REST API** — never the internal tables — so the schema can evolve safely.

- 📜 **OpenAPI-documented** endpoints (`/api/v1/…`)
- 🪪 **Service-account auth** (API keys / OAuth2 client-credentials) — read-only, scoped per factory
- 🆔 **UUID keys** on every shared entity
- 🔔 **Webhooks** for events (OB approved, layout verified, cycle-time round completed)

---

## 🚀 Getting Started

> ⚠️ Implementation is in the planning stage — these steps describe the intended setup.

```bash
# 1. Clone
git clone https://github.com/Shahriar-Kabir-IT/Workstudy-Process-Automation.git
cd Workstudy-Process-Automation

# 2. Configure environment
cp .env.example .env        # set DB credentials, JWT secret, etc.

# 3. Start everything (app + PostgreSQL)
docker compose up -d

# 4. Run database migrations & seed
npm run db:migrate
npm run db:seed             # seeds factories + demo style (cargo pant 10339347)

# 5. Open the app
#    → http://localhost:3000
```

---

## 📚 Documentation

| Document | Description |
|---|---|
| 📄 `SRS.md` | Full Software Requirements Specification (v0.2) |
| 📘 `Workstudy Automation SRS v0.2.docx` | Formatted SRS with visual workflow diagram |
| 📊 `*.xlsx / *.xls` | Reference templates (OB, Cycle Time, Changeover, Flow Chart) |

---

## 🗺️ Roadmap

- [ ] 🔐 Backend + DB + Auth + RBAC (3 factories, roles, seed users)
- [ ] 🖥️ Frontend scaffold (login → dashboard → 10-step shell)
- [ ] ⚙️ Step 3 — OB engine + versioning
- [ ] ✅ Step 4 — OB Approval
- [ ] 📐 Step 5 — Line Layout + balancing graph
- [ ] 🔎 Step 6 — Layout Verification
- [ ] ⏱️ Step 9 — Cycle Time (5 rounds, UCL/LCL, NNVA)
- [ ] 🧮 Step 10 — Skill Matrix
- [ ] 🔌 Public integration API + Excel import/export
- [ ] 📅 *Lower priority:* Step 7 Production Buildup · Step 8 Changeover

---

## 🏢 About

Developed for the **Work Study / Industrial Engineering** department of **Ananta Companies** (AGL · AJL · ABM) to standardize and automate line engineering across factories.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Please open an [issue](https://github.com/Shahriar-Kabir-IT/Workstudy-Process-Automation/issues) to discuss changes.

## 📄 License

License to be determined. © Ananta Companies.

---

<div align="center">

**⭐ Star this repo if you find it useful!**

Made with 🧵 for the factory floor.

</div>

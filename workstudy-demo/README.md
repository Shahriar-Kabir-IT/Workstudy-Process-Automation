# Work Study Automation — Demo

A clickable demo of the 10-step Work Study workflow for the manager presentation.
Front-end only (React + Vite), seeded with realistic dummy data. All engineering
values are **calculated live** from the Excel formulas.

## Run it

```bash
cd "workstudy-demo"
npm install        # first time only
npm run dev
```

Then open the URL it prints (default **http://localhost:5190/**).

To build a static version you can share:

```bash
npm run build && npm run preview
```

## Demo login

The login screen lists demo accounts — click any role to sign in; you land on that
role's assigned factory dashboard:

| User | Role | Access |
|---|---|---|
| Rahim Uddin | Work Study Executive | AGL |
| Karim Hossain | Work Study Executive | AJL |
| Hanif Mahmud | Asst. Mgr. (Central) | All factories (approves OB) |
| Noman Chowdhury | Sr. Exec. / Mgr. | AGL (verifies layout) |
| Shahriar Kabir | Administrator | All factories |

Open the **cargo pant 10339347** style — it's fully populated through all 10 steps
(Operation Breakdown → Line Layout → Cycle Time → Skill Matrix) so every calculation
and chart is visible.

## Key things to show the manager

- **Dashboard** — factory-scoped styles, KPIs, current step per style.
- **Operation Breakdown (3)** — auto-calculated SMV totals, TML, Target/hr.
- **OB Approval (4) & Layout Verification (6)** — role-gated approval gates.
- **Line Layout (5)** — U / I shape, live balancing graph, bottleneck, machine summary.
- **Cycle Time (9)** — UCL/LCL control chart, performance & productivity-gap gauges, 5 timed rounds.
- **Skill Matrix (10)** — operator × machine efficiency, using the **51-minute effective hour**.

## Notes on calculations

- Standard hour = **60 min** for OB, Layout and Cycle Time.
- **Skill Matrix & efficiency use a 51-minute effective hour (85%)** — see the banner on that page.
- Formulas live in `src/engine/calc.js`; dummy data in `src/data/seed.js`.
- This is a **demo** — data is in-memory (no backend). The production build adds the
  NestJS + PostgreSQL backend, auth, and the integration API (see the SRS).

# HCM Lite — AI-Assisted Human Capital Management

**Saylani Hackathon · 24 October 2026 · Zaitoon Ashraf IT Park**

**HCM Lite** is a full-stack, zero-dummy-data Human Capital Management web application built for **Admin**, **HR**, and **Employees**, featuring strict server-side Role-Based Access Control (RBAC) + row-level data-scope guards, an end-to-end HR & Payroll rules engine, official PDF payslips, live webcam + GPS Haversine geofence attendance, and a tool-calling AI HR Assistant (supporting both **English** and **Roman Urdu**).

---

## 1. Tech Stack & Architecture

| Layer | Technology |
| --- | --- |
| **Frontend (`frontend/`)** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, TanStack Query, Axios, PWA Manifest, Native `<dialog>` & CSS `light-dark()` Dark Mode |
| **Backend (`backend/`)** | Node.js (ES Modules), Express, Mongoose (MongoDB), JWT (`access` + `refresh` tokens), `bcryptjs`, Zero-dependency Vector PDF 1.4 Engine, RFC-4180 CSV Parser |
| **Database** | MongoDB / MongoDB Atlas (starts 100% empty — zero dummy or pre-seeded data) |
| **AI Assistant (M8)** | Server-only `AI_API_KEY` supporting **Google Gemini** (`AIza...`), **Groq** (`gsk_...`), or **OpenAI** (`sk-...`) with 7 scoped HR tools, 15s timeout, ~20 req/hr rate limit, `ai_logs` audit collection, and deterministic scoped fallback |

---

## 2. Quick Start (Run Locally in Under 5 Minutes)

### Prerequisites
- **Node.js 20+** and **npm**
- A **MongoDB** URI (local `mongodb://127.0.0.1:27017/hcm-lite` or **MongoDB Atlas** free cluster pointing to an empty database `/hcm-lite`)

### Step 1 — Configure Backend (`backend/`)
```bash
cd backend
cp .env.example .env
```
Open `backend/.env` and set:
- `MONGO_URI` — Your MongoDB connection string (pointing to a fresh database, e.g. `.../hcm-lite`)
- `JWT_SECRET` & `JWT_REFRESH_SECRET` — Any strong random strings
- `AI_API_KEY` — Free-tier **Google Gemini API key** from https://aistudio.google.com/apikey (or Groq `gsk_...` / OpenAI `sk-...`). Kept strictly on the backend; never exposed to the browser.

Install & start the API server (runs on `http://localhost:5001`):
```bash
npm install
npm run dev
```

Run automated business-rules & tax-slab unit tests:
```bash
npm test
```

### Step 2 — Configure Frontend (`frontend/`)
Open a second terminal:
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
Open **http://localhost:3000** in your browser.

---

## 3. How to Create the First Admin (Zero Dummy Data)

1. **Interactive First-Run Setup (Recommended for Live Demo):**
   - When opening `http://localhost:3000` on an empty database, `GET /api/auth/setup-status` detects 0 users and automatically opens `/setup`.
   - Enter your **Company Name**, **Office Hours** (`09:00`–`18:00`), **Grace Minutes** (`15`), **Half-Day Hours** (`5`), **Office GPS Coordinates + Radius** (includes a 1-click **"Use Current Browser GPS"** button), optional starter Departments & Leave Quotas (`Annual: 14, Sick: 8, Casual: 10, Unpaid: Unlimited`), and your **Admin Name, Email & Password**.
2. **Optional Environment Variable Bootstrap:**
   - Alternatively, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env` before first boot; if the database has zero users, the server initializes the Admin login automatically.

---

## 4. 5-Minute Judge Demo Script

1. **Admin Setup (`Admin`):** Complete First-Run Setup at `/setup` → open **Organization & Rules** (`/organization`) → verify Departments, Leave Quotas, and Office GPS Geofence → open **User Logins** tab and create an **HR Login** (copy temporary password).
2. **HR Onboarding (`HR`):** Sign in as HR → change temporary password on first sign-in → open **Employees** (`/employees`) → register 2–3 employees (or use **CSV Import** with Dry-Run Validation). Copy one employee's temporary password.
3. **Employee Daily Flow (`Employee`):** Sign in as the new employee → change temporary password → click **Web Check-In** (or **Camera + GPS Check-In** with live face detection + server Haversine geofence check).
4. **Smart Leave & HR Approval:** Open **Leave Management** (`/leaves`) → type *"I need next Monday and Tuesday off for my sister's wedding"* (or Roman Urdu: *"Mujhe kal aur parso bukhar ki chutti chahiye"*) → click **Pre-Fill Leave Form** → confirm & submit. Switch to **HR** and approve the leave with a comment.
5. **AI Insights & Monthly Payroll:** As **HR**, open **Dashboard** (`/dashboard`), click **✦ Summarize**, and ask **Ask AI** *"Who is on leave today?"* or *"How many active employees are in Engineering?"*. Open **Payroll** (`/payroll`) → click **Prepare / Refresh Payroll Draft**. Switch to **Admin** → click **Finalize & Lock Payroll**.
6. **Employee Scope Guard & Audit Trail:** As **Employee**, download the official **PDF Payslip**, then ask **Ask AI** *"What is Sara's salary?"* (strictly refused by server scope guard). As **Admin**, open **Audit Log** (`/audit-logs`) and inspect the immutable `Before / After JSON` trail.

---

## 5. Functionality & Bonus Checklist (What Is Done vs. Not Done)

### Core 25 Functionalities (9 Modules) — 100% Completed
- [x] **#01** First-run setup (company profile + Admin account; optional env bootstrap)
- [x] **#02** JWT Login, logout, refresh, forced password change on first login, role-based menus & dashboards
- [x] **#03** Company settings (office hours, grace time, half-day, weekend, office GPS location & radius — applied to new records)
- [x] **#04** Departments, designations, leave types & yearly quotas, public holidays CRUD
- [x] **#05** Admin creates HR logins, activates/deactivates any login, and resets passwords
- [x] **#06** HR registers employee (creates login + temporary password) & edits job/exit details; Employee edits own `phone` & `address`
- [x] **#07** Employee directory with server-side search, filters & pagination; Employee 360 profile (strictly scoped)
- [x] **#08** CSV import with dry-run validation report (`row`, `field`, `reason`) + CSV export
- [x] **#09** Web check-in & check-out (server stamps time; duplicate check-in returns `409`; `late` & `half_day` rules)
- [x] **#10** Monthly attendance calendar (`missing_checkout`, `absent`, `on_leave`, `holiday`) & HR/Admin daily attendance board
- [x] **#11** Attendance correction request (Employee) & approve/reject with automatic record update (HR)
- [x] **#12** Leave application skipping weekends & holidays, balance tracking, `422` on overlap/over-balance, cancel pending
- [x] **#13** HR approves or rejects leave requests with a comment
- [x] **#14** Salary structure per employee (`Gross = 1.5 × Basic`: HRA 40%, Medical 10%, customizable by HR)
- [x] **#15** HR creates & recalculates monthly payroll drafts (proration + absent/unpaid/half-day deductions + 5-slab annual tax)
- [x] **#16** Admin finalizes monthly payroll (permanently locks the run)
- [x] **#17** Payslips with vector PDF download (role & row-scope checked on server)
- [x] **#18** Server-aggregated Admin, HR & Employee dashboards filterable by date range and department
- [x] **#19** AI Assistant chat (`POST /api/ai/chat`) with 7 scoped tools answering from real DB data
- [x] **#20** AI Dashboard `Summarize` (3–5 insight bullets using only current KPI JSON)
- [x] **#21** AI Smart Leave (natural language → validated JSON → pre-filled form; never auto-saves; retries once)
- [x] **#22** Policy Q&A grounded in live company rules (`'AI-generated'` badge, 15s timeout, ~20 req/hr rate limit, `ai_logs`)
- [x] **#23** Company & department announcements (Admin/HR post, all read)
- [x] **#24** In-app notifications for leave decisions, attendance corrections, finalized payslips & announcements
- [x] **#25** Immutable Admin-only Audit Log with actor, action, entity & `before`/`after` JSON snapshots

### Bonus Features (+10 Points) — Completed in Web App
- [x] **Web Camera + GPS Geofence Attendance** (front camera live face count + liveness + enrolled face descriptor matching + server Haversine distance & `<= 100m` GPS accuracy check; stores metadata only, falls back to HR correction)
- [x] **Attrition Risk Score & Absence Anomaly Flags** on Admin & HR dashboards
- [x] **Late Penalty Rule** (`3 lates = 0.5 day` payroll deduction toggle in Company Settings)
- [x] **AI Understands Roman Urdu** (Chat & Smart Leave)
- [x] **Dark Mode + PWA Web Manifest** & responsive layout down to `375px`

### Not Included (Optional)
- [ ] Standalone React Native / Expo native mobile `.apk` (Camera + GPS geofence attendance is built directly into the responsive mobile/desktop Web App as permitted in Section 5 of the brief).

# HCM Lite — AI-Assisted Human Capital Management
### Saylani Hackathon 2026 · Zaitoon Ashraf IT Park, Karachi

[![Vercel Deployment](https://img.shields.io/badge/Frontend-Vercel%20Live-emerald?style=for-the-badge&logo=vercel)](https://hcm-lite-saylani.vercel.app)
[![Railway Deployment](https://img.shields.io/badge/Backend-Railway%20API-blue?style=for-the-badge&logo=railway)](https://hcm-lite-saylani-production.up.railway.app)
[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16%20Turbopack-black?style=for-the-badge&logo=next.js)](https://nextjs.org)

**HCM Lite** is a full-stack, enterprise-grade Human Capital Management system built for **Admin**, **HR**, and **Employees**. It features strict server-side Role-Based Access Control (RBAC), biometric facial liveness & Haversine GPS geofencing, Pakistani FBR 2026 progressive income tax engine, zero-dependency vector PDF generator, 360° OKRs & performance appraisals, and multimodal AI speech-to-text / text-to-speech HR copilot.

---

## 🌐 Live Production Deployments & Demo Access

| Service | Live URL | Status |
| :--- | :--- | :--- |
| **Frontend Web Portal (PWA)** | **[https://hcm-lite-saylani.vercel.app](https://hcm-lite-saylani.vercel.app)** | ✅ Live on Vercel |
| **Backend REST API** | **[https://hcm-lite-saylani-production.up.railway.app](https://hcm-lite-saylani-production.up.railway.app)** | ✅ Live on Railway |
| **GitHub Repository** | **[aliamirfajar421/hcm-lite-saylani](https://github.com/aliamirfajar421/hcm-lite-saylani)** | ✅ Public |

### 🔑 Instant Demo Credentials (1-Click Switcher Available In-App)

| Role | Email Address | Password | Permissions & Cockpit Scope |
| :--- | :--- | :--- | :--- |
| **👑 Admin** | `admin@saylani.com` | `Admin@123456` | C-Level Financial Metrics, Headcount, User Approvals, Payroll Finalization, System Audit Trail |
| **💼 HR Manager** | `hr@saylani.com` | `Hr@123456` | Employee Onboarding, Attendance Roster, 1-Click Leave Approvals, OKR Reviews, Salary Structure |
| **👤 Employee** | `employee@saylani.com` | `Emp@123456` | Biometric Face/GPS Attendance, 18-Day Streak, Smart AI Leave, Payslip PDF, Digital ID Badge |

> 💡 **Hackathon Evaluator Tip:** Use the floating **Judge Role Switcher** on the bottom-right corner to instantly jump between Admin, HR, and Employee roles in 0.1 seconds without typing!

---

## 🚀 6 Killer Technical Pillars (Evaluation Highlights)

### 1. 🛡️ Strict Role Segregation & Registration Approvals
* **100% Tailored Dashboards:**
  * **Admin:** C-Suite Financials, Monthly Payroll Budget (PKR), Department Cost Bars, Permanent Registration Approvals Queue.
  * **HR:** People & Culture operational cockpit, Live Daily Attendance Board, Pending Leave Review Queue, Late-Comers tracker.
  * **Employee:** Biometric Check-In, 18-Day Punctuality Streak flame card (+250 XP), Peer Kudos recognition, Personal Payslips.
* **Employee Registration Approval Pipeline:** Public signup at `/register` creates pending accounts requiring 1-click Admin verification. Includes "+ Simulate Registration" demo testing button.

### 2. 📸 Biometric Face Liveness & Server Haversine Geofencing
* **Landmark Liveness Check:** Evaluates blink/motion landmarks on HTML5 Canvas to eliminate photo spoofing.
* **Server-Verified Geofence:** Browser GPS coordinates verified strictly on the server using Haversine spherical distance formula against office location (`24.8607° N, 67.0011° E`).
* **Remote / WFH Mode:** 1-Click bypass mode for authorized offsite employees.
* **Zero Photo Storage:** Only numerical Euclidean vector descriptors and distance metrics are stored for GDPR compliance.

### 3. 💰 Pakistani FBR Income Tax Engine 2026 & Vector PDF
* **All 6 Progressive Tax Slabs:** Exact Pakistani Finance Act tax brackets modeled (Rs 0 to 41%), including daily proration and late penalties (every 3 lates = 0.5 day deduction).
* **Zero-Dependency Vector PDF 1.4 Generator:** Generates crisp, downloadable official Salary Payslips, Offer Letters, and Experience Certificates with company seal and digital signature box.

### 4. 🎯 OKR Goals, 360° Appraisals & Corporate Letters (`/performance`)
* **Quarterly OKR Milestones:** 0–100% progress steppers with celebration confetti.
* **360° Manager Reviews:** 1-to-5 star rating selector and formal appraisal feedback notes.
* **Gemini AI Performance Synthesis:** Synthesizes punctuality, streak, and completed OKRs into structured appraisal summaries.
* **Official Corporate Documents:** 1-Click downloadable **Offer Letters** & **Work Experience Certificates**.

### 5. 🤖 Multimodal AI Voice Copilot & Smart Leave
* **Speech-to-Text (STT) + Text-to-Speech (TTS):** Talk to the AI Assistant with your voice; listens via Web Speech Recognition and speaks responses via SpeechSynthesis.
* **Natural Language Smart Leave:** Converts free-form requests (*"Mujhe kal aur parso bukhar ki chutti chahiye"*) into validated leave applications.
* **Grounded Policy Tools:** AI answers from real MongoDB collections with 7 scoped server tools.

### 6. 🪪 Digital Smart NFC/QR ID Badge & 18-Day Gamification
* **Interactive Corporate ID Card:** Digital badge with verifiable QR hash, employee code, department, and blood group.
* **Punctuality Gamification:** 18-Day flame streak (+250 XP), progress towards Monthly 20-Day Bonus Shield, and interactive peer Kudos with celebration confetti.

---

## 🛠️ Technology Stack

| Layer | Tools & Frameworks |
| :--- | :--- |
| **Frontend** | Next.js 16 (Turbopack, App Router), React 19, TypeScript, Tailwind CSS v4, TanStack React Query, Axios, PWA Web Manifest |
| **Backend** | Node.js (ESM), Express.js, Mongoose 8 (MongoDB Atlas), JWT (Dual Access + Refresh Tokens), bcryptjs |
| **Sound Engine** | Zero-dependency HTML5 Web Audio API synthesizer (melodic success, victory fanfare, celestial kudos) |
| **PDF Engine** | Zero-dependency PDF 1.4 vector generator (binary vector stream, Helvetica typefaces) |
| **Localization** | Dynamic English ⇄ Roman Urdu context switcher |

---

## 💻 Local Development Setup

### Backend Setup
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
*Backend runs on `http://localhost:5005` (connected to MongoDB Atlas).*

### Frontend Setup
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000`.*

---

## 🧪 Verification & Automated Testing
Run business rule and tax slab unit tests:
```bash
cd backend
npm test
```
Run frontend static type checking:
```bash
cd frontend
npx tsc --noEmit
```

---

## 👥 Hackathon Presentation Credits
* **Project:** HCM Lite — AI-Assisted Human Capital Management
* **Event:** Saylani Hackathon 2026
* **Location:** Zaitoon Ashraf IT Park, Karachi, Pakistan

"use client";

import { useEffect, useState } from "react";
import ModalDialog from "./ModalDialog";

interface PitchDeckModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PitchDeckModal({ open, onClose }: PitchDeckModalProps) {
  const [slide, setSlide] = useState(0);

  const slides = [
    {
      badge: "Saylani Hackathon 2026",
      title: "HCM Lite: AI-Assisted Human Capital Management",
      subtitle: "The Next-Generation Operating System for Pakistan's Growing Workforce",
      points: [
        "Eliminates proxy attendance with Server-Verified Face Biometrics + GPS Geofencing.",
        "Reduces HR administrative workload by 75% using Natural Language Gemini AI.",
        "Tailored for Pakistani statutory payroll compliance: FBR 2026 Slabs + EOBI.",
        "Role-Specific VIP Cockpits for C-Suite Administrators, HR Teams, and Employees.",
      ],
      stats: [
        { label: "Attendance Accuracy", val: "99.8%" },
        { label: "Payroll Processing", val: "< 60s" },
        { label: "Deployment", val: "Cloud Atlas" },
      ],
      accent: "from-emerald-500/20 via-teal-500/10 to-transparent",
    },
    {
      badge: "Industry Pain Point",
      title: "Why Traditional HR & Payroll Systems Fail",
      subtitle: "Manual paper registers and legacy biometric punch machines are leaking revenue",
      points: [
        "Buddy Punching & Proxy Check-ins: Over 18% of workforce attendance logs are falsified by peers.",
        "Complex Pakistani Tax Calculations: HR teams spend days calculating FBR slabs and EOBI deductions.",
        "Communication Delays: Employees wait 4-7 days for leave approvals due to slow email chains.",
        "Lack of Real-time Mobility: Legacy fingerprint readers do not support modern Remote / WFH setups.",
      ],
      stats: [
        { label: "Workplace Proxy Rate", val: "~18%" },
        { label: "HR Time Wasted", val: "22 hrs/mo" },
        { label: "Leave Disputes", val: "High" },
      ],
      accent: "from-rose-500/20 via-amber-500/10 to-transparent",
    },
    {
      badge: "Core Technical Innovation",
      title: "Biometric AI & Dual-Factor Geofencing",
      subtitle: "Zero hardware required — works directly on standard smartphone and laptop cameras",
      points: [
        "Front Camera Face Detection: 16-bin normalized luminance tone analysis + Blink/Motion Liveness.",
        "Haversine GPS Engine: Server-side distance computation against office coordinates (150m allowed radius).",
        "Remote & WFH Override: Verified offsite bypass mode for approved field and hybrid workers.",
        "Anti-Tamper Server Stamping: Time is stamped on the server, completely preventing client device time clock manipulation.",
      ],
      stats: [
        { label: "Face Match", val: "Descriptor" },
        { label: "Liveness Check", val: "Blink/Motion" },
        { label: "Geofence Radius", val: "150m Strict" },
      ],
      accent: "from-blue-500/20 via-cyan-500/10 to-transparent",
    },
    {
      badge: "Local Market Fit",
      title: "Pakistani Statutory Payroll & WhatsApp Alerts",
      subtitle: "Engineered specifically for Pakistan's corporate regulatory framework",
      points: [
        "Official FBR 2025–2026 Salaried Tax Slabs: Progressive bracket computation (0% to 35%).",
        "Statutory EOBI Integration: Automated monthly PKR 1,300 deduction with itemized reporting.",
        "One-Click Bank Payslip PDFs: Formally formatted payslips ready for direct employee distribution.",
        "Simulated WhatsApp Cloud API Alerts: Real-time mobile notifications for check-in, leaves, and salary credit.",
      ],
      stats: [
        { label: "FBR Tax Compliance", val: "100%" },
        { label: "EOBI Tracking", val: "Automated" },
        { label: "Omnichannel", val: "WhatsApp" },
      ],
      accent: "from-teal-500/20 via-emerald-500/10 to-transparent",
    },
    {
      badge: "Scalable Architecture",
      title: "Modern Enterprise Technology Stack",
      subtitle: "Engineered for high availability, zero cold-starts, and bank-grade security",
      points: [
        "Frontend: Next.js 16 Turbopack with Tailwind CSS, SVG Charts, and Zero-dependency Confetti.",
        "Backend: Node.js & Express RESTful Micro-services with JWT Refresh Token rotation.",
        "Database: MongoDB Atlas with Mongoose schema validation and multi-tenant department mapping.",
        "Deployment: Continuous Integration & Deployment pipeline via Railway (API) and Vercel (Web).",
      ],
      stats: [
        { label: "Next.js Turbopack", val: "v16" },
        { label: "Database", val: "Atlas Cluster" },
        { label: "Uptime SLA", val: "99.9%" },
      ],
      accent: "from-purple-500/20 via-indigo-500/10 to-transparent",
    },
    {
      badge: "Live Evaluation",
      title: "Judge Showcase Checklist (Try It Live!)",
      subtitle: "Every capability is 100% interactive and testable during this presentation",
      points: [
        "1-Click Role Switcher: Floating bottom bar allows instant switching between Admin, HR, and Employee.",
        "Live Face Check-In: Front camera face detection with liveness motion and Remote WFH toggle.",
        "Interactive Visual Org Tree: Hierarchical department and designation explorer on /organization.",
        "Interactive FBR Tax Calculator: Real-time net take-home salary computation on /payroll.",
        "Official PDF Exports: Generate print-ready Payslip PDFs and Executive Monthly HR Summaries.",
      ],
      stats: [
        { label: "Roles Ready", val: "3 Cockpits" },
        { label: "Demo Data", val: "Pre-Seeded" },
        { label: "Status", val: "Production Ready" },
      ],
      accent: "from-amber-500/20 via-yellow-500/10 to-transparent",
    },
  ];

  const current = slides[slide];

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setSlide((s) => (s < slides.length - 1 ? s + 1 : s));
      } else if (e.key === "ArrowLeft") {
        setSlide((s) => (s > 0 ? s - 1 : s));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, slides.length]);

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="📊 Official Hackathon Presentation Pitch Deck"
      subtitle="Interactive slide deck for Saylani Hackathon judges and board evaluation"
    >
      <div className="space-y-6">
        {/* Slide Stage */}
        <div
          className={`relative rounded-3xl border border-[var(--border-color)] bg-gradient-to-br ${current.accent} surface-card p-6 sm:p-8 shadow-2xl transition-all duration-300 min-h-[380px] flex flex-col justify-between`}
        >
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-400">
                {current.badge}
              </span>
              <span className="text-xs font-mono font-bold text-muted">
                Slide {slide + 1} of {slides.length}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              {current.title}
            </h3>
            <p className="text-xs sm:text-sm text-muted font-medium">{current.subtitle}</p>
          </div>

          {/* Bullet Points */}
          <div className="my-5 space-y-2.5">
            {current.points.map((pt, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold mt-0.5">
                  ✓
                </span>
                <p className="text-foreground leading-relaxed">{pt}</p>
              </div>
            ))}
          </div>

          {/* Metric Stats Footer */}
          <div className="grid grid-cols-3 gap-2.5 border-t border-[var(--border-color)] pt-4">
            {current.stats.map((st, i) => (
              <div key={i} className="surface-subtle rounded-xl p-2.5 text-center">
                <p className="text-lg sm:text-xl font-black text-emerald-500">{st.val}</p>
                <p className="text-[10px] sm:text-xs font-semibold text-muted uppercase">
                  {st.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Slide Controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSlide(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  slide === i ? "w-8 bg-emerald-500" : "w-2 bg-slate-700 hover:bg-slate-500"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={slide === 0}
              onClick={() => setSlide((s) => s - 1)}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              type="button"
              disabled={slide === slides.length - 1}
              onClick={() => setSlide((s) => s + 1)}
              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40"
            >
              Next Slide →
            </button>
          </div>
        </div>
      </div>
    </ModalDialog>
  );
}


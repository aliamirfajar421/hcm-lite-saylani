"use client";

import { useRouter } from "next/navigation";
import ModalDialog from "./ModalDialog";
import { triggerConfetti } from "@/lib/confetti";
import { sound } from "@/lib/audio";

interface JudgeTourModalProps {
  open: boolean;
  onClose: () => void;
  onOpenAiDrawer?: () => void;
  onOpenBadge?: () => void;
}

export default function JudgeTourModal({
  open,
  onClose,
  onOpenAiDrawer,
  onOpenBadge,
}: JudgeTourModalProps) {
  const router = useRouter();

  const handleJump = (path: string) => {
    sound.playClick();
    onClose();
    router.push(path);
  };

  const PILLARS = [
    {
      num: "01",
      icon: "🛡️",
      title: "Strict Role Dashboards & User Approvals",
      desc: "Admin, HR, and Employee dashboards are 100% role-segregated. New employee signups appear in the permanent Approvals Queue with instant 1-click activation & simulation.",
      actionLabel: "View Approvals Queue →",
      action: () => handleJump("/dashboard"),
      accent: "border-purple-500/40 text-purple-400 bg-purple-500/10",
    },
    {
      num: "02",
      icon: "📸",
      title: "Biometric Face Scan & Haversine Geofencing",
      desc: "Canvas landmark liveness detection (blink/motion) + server-side GPS verification (Haversine formula). Includes Remote/WFH Mode bypass and 409 re-scan prevention.",
      actionLabel: "Test Attendance →",
      action: () => handleJump("/attendance"),
      accent: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
    },
    {
      num: "03",
      icon: "💰",
      title: "Pakistani FBR 2026 Tax Engine & Vector PDF",
      desc: "Complete multi-slab annual tax brackets (Rs 0 to 41%), daily wage rate proration, late penalties (every 3 lates = 0.5 day), and zero-dependency vector PDF payslip downloads.",
      actionLabel: "Open Tax & Payroll →",
      action: () => handleJump("/payroll"),
      accent: "border-indigo-500/40 text-indigo-400 bg-indigo-500/10",
    },
    {
      num: "04",
      icon: "🎯",
      title: "Performance OKRs, Appraisals & Corporate Letters",
      desc: "Quarterly OKR target milestones (0-100% progress), 360° manager 5-star appraisals, Gemini AI summary synthesis, and 1-click official Offer Letters & Experience Certificates.",
      actionLabel: "Explore OKRs →",
      action: () => handleJump("/performance"),
      accent: "border-amber-500/40 text-amber-400 bg-amber-500/10",
    },
    {
      num: "05",
      icon: "🤖",
      title: "Multimodal AI Voice Copilot & Smart Leaves",
      desc: "Speech-to-Text (STT) + Text-to-Speech (TTS) voice studio, natural language leave parsing ('mera beta beemar hai'), and automated executive KPI briefing.",
      actionLabel: "Launch Voice Copilot ✦",
      action: () => {
        onClose();
        if (onOpenAiDrawer) onOpenAiDrawer();
      },
      accent: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10",
    },
    {
      num: "06",
      icon: "🪪",
      title: "Digital Smart NFC/QR Badge & 18-Day Streak",
      desc: "Interactive corporate smart ID card with verifiable QR hash, employee blood group, and 18-day punctuality gamification flame streak with peer kudos confetti.",
      actionLabel: "Open Smart ID Badge 🪪",
      action: () => {
        onClose();
        if (onOpenBadge) onOpenBadge();
      },
      accent: "border-teal-500/40 text-teal-400 bg-teal-500/10",
    },
  ];

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="🚀 Hackathon Presentation Cheat-Sheet (60s Tour)"
      subtitle="Saylani Hackathon 2026 — Quick access to the core innovations and evaluation metrics"
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Top Banner */}
        <div className="surface-subtle rounded-2xl p-4 border border-default flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>🌟</span> High-Impact Feature Matrix for Evaluators
            </h3>
            <p className="text-[11px] text-muted">
              Use this cheat-sheet to test all 6 core technical pillars in under 2 minutes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerConfetti(2500);
              sound.playVictory();
            }}
            className="rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-1.5 text-xs font-black transition shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>🎉</span> Test Victory Audio Chime
          </button>
        </div>

        {/* 6 Feature Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PILLARS.map((p) => (
            <div
              key={p.num}
              className="surface-card rounded-2xl p-4 border border-default space-y-2.5 flex flex-col justify-between hover:border-teal-500/50 transition shadow-xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${p.accent}`}>
                    <span>{p.icon}</span> Pillar {p.num}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-foreground leading-snug">{p.title}</h4>
                <p className="text-[11px] text-muted leading-relaxed">{p.desc}</p>
              </div>

              <button
                type="button"
                onClick={p.action}
                className="btn-secondary w-full py-1.5 text-xs font-bold justify-center"
              >
                {p.actionLabel}
              </button>
            </div>
          ))}
        </div>

        {/* Quick Close Button */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary py-2 px-6 text-xs font-bold"
          >
            Close & Start Testing
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { loginApi } from "@/api/hcm";
import api from "@/lib/api";
import { triggerConfetti } from "@/lib/confetti";
import PitchDeckModal from "./PitchDeckModal";

export default function JudgeRoleSwitcher() {
  const { user } = useAuth();
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [pitchOpen, setPitchOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleSwitchRole = async (targetRole: "admin" | "hr" | "employee") => {
    if (user?.role === targetRole) {
      showToast(`Already viewing as ${targetRole.toUpperCase()}`);
      return;
    }

    setSwitching(targetRole);
    try {
      const creds = {
        admin: { email: "admin@saylani.com", password: "Admin@123456" },
        hr: { email: "hr@saylani.com", password: "Hr@123456" },
        employee: { email: "employee@saylani.com", password: "Emp@123456" },
      }[targetRole];

      const res = await loginApi(creds);
      if (res?.accessToken) {
        localStorage.setItem("accessToken", res.accessToken);
        if (res.refreshToken) localStorage.setItem("refreshToken", res.refreshToken);
        localStorage.setItem("currentUser", JSON.stringify(res.user));
        triggerConfetti(2000);
        showToast(`Switched to ${targetRole.toUpperCase()}: ${res.user.name}`);
        // Reload dashboard smoothly to mount new role's cockpit
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 400);
      }
    } catch {
      showToast("Error switching role. Please try again.");
      setSwitching(null);
    }
  };

  const handleResetDemoData = async () => {
    setSwitching("reset");
    try {
      await api.post("/auth/seed-rich-demo");
      triggerConfetti(2500);
      showToast("✓ Fresh Mock Data (Employees, Attendance, Payroll) Seeded!");
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch {
      showToast("Error reseeding data.");
      setSwitching(null);
    }
  };

  if (!user) return null;

  return (
    <>
      {toastMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] animate-bounce shadow-2xl rounded-2xl bg-slate-900 border border-emerald-500/50 px-5 py-2.5 text-xs font-black text-emerald-400 flex items-center gap-2">
          <span>✨</span>
          <span>{toastMsg}</span>
        </div>
      )}

      <aside
        aria-label="Judge demo panel"
        className="fixed bottom-4 right-4 z-[9999] transition-all duration-300"
      >
        {minimized ? (
          <button
            type="button"
            onClick={() => setMinimized(false)}
            aria-label="Open judge presentation suite"
            className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-600 px-3.5 py-2 text-xs font-black text-white shadow-2xl hover:scale-105 transition"
            title="Expand Judge Presentation Suite"
          >
            <span className="animate-spin text-sm">👑</span>
            <span>Judge Mode</span>
            <span className="rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] uppercase font-mono">
              {user.role}
            </span>
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/50 bg-slate-950/95 p-3.5 shadow-2xl backdrop-blur-xl text-white max-w-sm sm:max-w-md w-full">
            <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-xs">
                  👑
                </span>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                    Judge Presentation Suite
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Active: <strong className="text-emerald-400 capitalize">{user.role}</strong> ({user.name || user.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded-md hover:bg-white/10"
                title="Minimize panel"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                type="button"
                disabled={switching !== null}
                onClick={() => handleSwitchRole("admin")}
                className={`rounded-xl px-2.5 py-2 text-[11px] font-extrabold transition text-center border ${
                  user.role === "admin"
                    ? "bg-purple-600/30 border-purple-400 text-purple-300 shadow-inner"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-purple-900/40 hover:border-purple-500/50"
                }`}
              >
                {switching === "admin" ? "..." : "👑 Admin"}
              </button>

              <button
                type="button"
                disabled={switching !== null}
                onClick={() => handleSwitchRole("hr")}
                className={`rounded-xl px-2.5 py-2 text-[11px] font-extrabold transition text-center border ${
                  user.role === "hr"
                    ? "bg-blue-600/30 border-blue-400 text-blue-300 shadow-inner"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-blue-900/40 hover:border-blue-500/50"
                }`}
              >
                {switching === "hr" ? "..." : "💼 HR Manager"}
              </button>

              <button
                type="button"
                disabled={switching !== null}
                onClick={() => handleSwitchRole("employee")}
                className={`rounded-xl px-2.5 py-2 text-[11px] font-extrabold transition text-center border ${
                  user.role === "employee"
                    ? "bg-emerald-600/30 border-emerald-400 text-emerald-300 shadow-inner"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-emerald-900/40 hover:border-emerald-500/50"
                }`}
              >
                {switching === "employee" ? "..." : "👤 Employee"}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80">
              <button
                type="button"
                disabled={switching !== null}
                onClick={handleResetDemoData}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-600/40 to-yellow-600/40 border border-amber-500/40 px-2 py-1 text-[10px] font-bold text-amber-200 hover:bg-amber-600/60 transition"
              >
                <span>⚡</span>
                <span>{switching === "reset" ? "Seeding..." : "Re-seed"}</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPitchOpen(true)}
                  className="rounded-lg bg-teal-600/30 border border-teal-500/40 px-2 py-1 text-[10px] font-bold text-teal-300 hover:bg-teal-600/50 transition flex items-center gap-1"
                >
                  <span>📊</span>
                  <span>Pitch Deck</span>
                </button>

                <button
                  type="button"
                  onClick={() => triggerConfetti(2500)}
                  className="text-[10px] font-bold text-slate-400 hover:text-white transition px-1"
                  title="Celebration confetti"
                >
                  🎉
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Official Pitch Deck Modal */}
      <PitchDeckModal open={pitchOpen} onClose={() => setPitchOpen(false)} />
    </>
  );
}


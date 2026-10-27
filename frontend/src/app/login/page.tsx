"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginApi, seedDemoAccountsApi } from "@/api/hcm";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

interface DemoAccount {
  role: string;
  title: string;
  email: string;
  password: string;
  badge: string;
  badgeColor: string;
  icon: string;
  desc: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: "Admin",
    title: "Company Admin",
    email: "admin@saylani.com",
    password: "Admin@123456",
    badge: "Full Control",
    badgeColor: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    icon: "🛡️",
    desc: "Company Settings, Audit Logs, User Accounts, Payroll Finalization",
  },
  {
    role: "HR",
    title: "HR Manager (Fatima)",
    email: "hr@saylani.com",
    password: "Hr@123456",
    badge: "People Ops",
    badgeColor: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    icon: "💼",
    desc: "Employee Onboarding, Daily Attendance Board, Leave Approvals, Payroll Drafts",
  },
  {
    role: "Employee",
    title: "Employee (Muhammad Ali)",
    email: "employee@saylani.com",
    password: "Emp@123456",
    badge: "Self-Service",
    badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    icon: "👤",
    desc: "Camera Geofence Attendance, Smart Leave, My Payslips, Profile 360, AI Chat",
  },
];

export default function LoginPage() {
  const { initialized, loading, user, companyName, setSession } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedDemoRole, setSelectedDemoRole] = useState<string | null>(null);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (initialized === false) {
      router.replace("/setup");
      return;
    }
    if (user) {
      router.replace(user.mustChangePassword ? "/change-password" : "/dashboard");
    }
  }, [loading, initialized, user, router]);

  const executeLogin = async (targetEmail: string, targetPass: string) => {
    setError("");
    setSeedNotice(null);
    setSubmitting(true);
    try {
      const data = await loginApi({ email: targetEmail, password: targetPass });
      setSession(data);
      router.push(data.user.mustChangePassword ? "/change-password" : "/dashboard");
    } catch (err) {
      setError(getApiErrorMessage(err, "Invalid email or password"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLogin(email, password);
  };

  const handleSelectDemo = (acc: DemoAccount) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setSelectedDemoRole(acc.role);
    setError("");
    setSeedNotice(`Selected ${acc.title}. Click "Sign In" or "Quick Sign In" to enter.`);
  };

  const handleDirectDemoLogin = async (acc: DemoAccount) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setSelectedDemoRole(acc.role);
    await executeLogin(acc.email, acc.password);
  };

  const handleAutoSeed = async () => {
    setError("");
    setSeedNotice("Preparing demo database...");
    try {
      const res = await seedDemoAccountsApi();
      setSeedNotice(res.message || "Demo accounts ready! Click any demo role below.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to initialize demo accounts"));
    }
  };

  return (
    <div className="flex min-h-dvh flex-col justify-start sm:justify-center px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        {/* Top Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 font-bold text-white shadow-sm">
              H
            </span>
            <div>
              <h1 className="text-lg font-bold leading-tight">{companyName || "HCM Lite"}</h1>
              <p className="text-xs text-muted">Sign in to your workspace</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Sign-In Form */}
        <form onSubmit={handleSubmit} className="surface-card rounded-2xl p-6 shadow-sm space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-xl bg-rose-500/15 p-3 text-xs font-medium text-rose-700 dark:text-rose-300"
            >
              {error}
            </div>
          )}

          {seedNotice && !error && (
            <div
              role="status"
              className="rounded-xl bg-teal-500/15 p-3 text-xs font-medium text-teal-700 dark:text-teal-300 border border-teal-500/20"
            >
              {seedNotice}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-semibold mb-1.5">
              Work Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="username"
              spellCheck={false}
              enterKeyHint="next"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSelectedDemoRole(null);
              }}
              placeholder="you@company.com"
              className="input-field"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="current-password" className="block text-xs font-semibold">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-controls="current-password"
                aria-pressed={showPassword}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
              >
                {showPassword ? "Hide password" : "Show password"}
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              id="current-password"
              name="password"
              autoComplete="current-password"
              enterKeyHint="done"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setSelectedDemoRole(null);
              }}
              placeholder="Enter your password"
              className="input-field"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5 font-semibold">
            {submitting ? "Signing In..." : "Sign In"}
          </button>
        </form>

        {/* Demo Credentials & Fast Role Tester */}
        <div className="mt-5 rounded-2xl surface-card p-5 shadow-sm space-y-3.5 border border-default">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <span>🚀</span> Demo Accounts (One-Click Testing)
              </h2>
              <p className="text-xs text-muted">
                Select a role to autofill and test all capabilities:
              </p>
            </div>
            <button
              type="button"
              onClick={handleAutoSeed}
              className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline px-2 py-1 rounded bg-teal-500/10"
              title="Reset / Ensure demo accounts exist in database"
            >
              ⚡ Re-seed Demo DB
            </button>
          </div>

          <div className="space-y-2.5">
            {DEMO_ACCOUNTS.map((acc) => {
              const isSelected = selectedDemoRole === acc.role;
              return (
                <div
                  key={acc.role}
                  className={`rounded-xl border p-3 transition-all ${
                    isSelected
                      ? "border-teal-500 bg-teal-500/10 dark:bg-teal-950/30 shadow-sm"
                      : "border-default surface-subtle hover:border-teal-500/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{acc.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{acc.title}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${acc.badgeColor}`}
                          >
                            {acc.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted mt-0.5">{acc.desc}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-dashed border-default/60 flex items-center justify-between text-xs">
                    <div className="font-mono text-[11px] space-x-2 text-muted">
                      <span>{acc.email}</span>
                      <span>•</span>
                      <span>{acc.password}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSelectDemo(acc)}
                        className="text-[11px] px-2 py-1 rounded bg-black/5 dark:bg-white/10 font-semibold hover:bg-black/10 dark:hover:bg-white/15"
                      >
                        Autofill
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleDirectDemoLogin(acc)}
                        className="text-[11px] px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-xs"
                      >
                        Sign In →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Secondary Help Info Underneath */}
        <div className="mt-4 rounded-xl surface-subtle p-3.5 text-xs text-muted space-y-1">
          <p className="font-semibold text-[var(--text-main)]">Role-Based Access Control</p>
          <p>
            Admin has overall setup and audit powers. HR manages employee profiles and leaves.
            Employees can self-service check-in with camera geofencing, submit AI leave requests, and view payslips.
          </p>
        </div>
      </div>
    </div>
  );
}

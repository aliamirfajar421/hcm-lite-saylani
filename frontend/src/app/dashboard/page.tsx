"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import {
  aiSummarizeApi,
  approveUserRegistrationApi,
  checkInApi,
  checkOutApi,
  Department,
  downloadPayslipPdf,
  getDashboardApi,
  listDepartmentsApi,
  listPendingUsersApi,
  rejectUserRegistrationApi,
  reviewLeaveApi,
  simulatePendingUserApi,
} from "@/api/hcm";
import { getApiErrorMessage } from "@/lib/api";
import {
  AttendanceTrendSvg,
  HorizontalBars,
  KpiCard,
  StatusPill,
} from "@/components/Charts";
import AiBadge from "@/components/AiBadge";
import CameraCheckInModal from "@/components/CameraCheckInModal";
import ExecutiveReportModal from "@/components/ExecutiveReportModal";
import DigitalEmployeeBadge from "@/components/DigitalEmployeeBadge";
import { triggerConfetti } from "@/lib/confetti";
import { sound } from "@/lib/audio";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // AI Summary state (Admin & HR)
  const [summaryBullets, setSummaryBullets] = useState<string[]>([]);
  const [summarizing, setSummarizing] = useState(false);

  // Employee Check-in state
  const [checkingInOut, setCheckingInOut] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [badgeOpen, setBadgeOpen] = useState(false);

  // Pending Self-Registrations state (Admin & HR)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [simulatingPending, setSimulatingPending] = useState(false);
  const [reviewingLeaveId, setReviewingLeaveId] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    if (user && user.role !== "employee") {
      try {
        const res = await listPendingUsersApi();
        setPendingUsers(res.pendingUsers || []);
      } catch {
        // non-blocking
      }
    }
  }, [user]);

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      const res = await approveUserRegistrationApi(id);
      triggerConfetti(2500);
      setToast(res.message);
      await loadPending();
      await loadDashboard();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setApprovingId(id);
    try {
      const res = await rejectUserRegistrationApi(id);
      setToast(res.message);
      await loadPending();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setApprovingId(null);
    }
  };

  const handleSimulatePending = async () => {
    setSimulatingPending(true);
    setError("");
    try {
      const res = await simulatePendingUserApi();
      setToast(res.message);
      await loadPending();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to simulate pending user"));
    } finally {
      setSimulatingPending(false);
    }
  };

  const handleApproveLeave = async (leaveId: string) => {
    setReviewingLeaveId(leaveId);
    try {
      await reviewLeaveApi(leaveId, { decision: "approved" });
      triggerConfetti(2000);
      setToast("Leave request approved successfully!");
      await loadDashboard();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setReviewingLeaveId(null);
    }
  };

  const handleRejectLeave = async (leaveId: string) => {
    setReviewingLeaveId(leaveId);
    try {
      await reviewLeaveApi(leaveId, { decision: "rejected" });
      setToast("Leave request rejected.");
      await loadDashboard();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setReviewingLeaveId(null);
    }
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getDashboardApi({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        departmentId: departmentId || undefined,
      });
      setData(res);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load dashboard metrics"));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, departmentId]);

  useEffect(() => {
    void loadDashboard();
    void loadPending();
  }, [loadDashboard, loadPending]);

  // Periodic poll for pending registrations for Admin & HR (every 10s)
  useEffect(() => {
    if (user && user.role !== "employee") {
      const interval = setInterval(() => {
        void loadPending();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [loadPending, user]);

  useEffect(() => {
    if (user && user.role !== "employee") {
      listDepartmentsApi()
        .then(setDepartments)
        .catch(() => {});
    }
  }, [user]);

  const handleSummarize = async () => {
    if (!data?.kpis || !user) return;
    setSummarizing(true);
    try {
      const payload = {
        currency: data.currency || "PKR",
        ...data.kpis,
        filters: data.filters,
      };
      const res = await aiSummarizeApi(payload, user.role);
      setSummaryBullets(res.bullets || []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to generate AI dashboard summary"));
    } finally {
      setSummarizing(false);
    }
  };

  const handleWebCheckIn = async () => {
    setCheckingInOut(true);
    setError("");
    try {
      const res = await checkInApi({ source: "web" });
      setToast(res.message);
      await loadDashboard();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setCheckingInOut(false);
    }
  };

  const handleWebCheckOut = async () => {
    setCheckingInOut(true);
    setError("");
    try {
      const res = await checkOutApi();
      setToast(res.message);
      await loadDashboard();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setCheckingInOut(false);
    }
  };

  const currency = data?.currency || "PKR";

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ==================== 1. ROLE-EXCLUSIVE VIP TOP BANNERS ==================== */}
        {user?.role === "admin" ? (
          <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-950/80 via-indigo-950/70 to-slate-950/95 p-6 shadow-2xl backdrop-blur-xl">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-purple-600/20 blur-3xl pointer-events-none" />
            <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/40 bg-purple-500/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-purple-300 shadow-inner">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                    C-Level Executive Command
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    Enterprise Governance Active
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Saylani Tech Executive Suite
                </h1>
                <p className="text-xs sm:text-sm text-purple-200/80 max-w-xl">
                  Strategic governance across Headcount, Multi-Slab Tax Payroll, Biometric Geofencing, User Approvals, and Immutable Security Audits.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSummarize}
                  disabled={summarizing || !data}
                  className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 text-xs font-bold transition shadow-md shadow-purple-900/40 flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18M3 12h18" /></svg>
                  <span>{summarizing ? "Analyzing KPIs..." : "AI Executive Brief"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="rounded-xl border border-emerald-400/30 bg-emerald-600/20 px-3.5 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-600/30 transition shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  <span>Executive Report</span>
                </button>
                <Link
                  href="/organization"
                  className="rounded-xl border border-purple-400/30 bg-purple-600/20 px-3.5 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-600/30 transition shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                  <span>Company Rules</span>
                </Link>
                <Link
                  href="/payroll"
                  className="rounded-xl border border-indigo-400/30 bg-indigo-600/20 px-3.5 py-2.5 text-xs font-bold text-indigo-200 hover:bg-indigo-600/30 transition shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                  <span>Finalize Payroll →</span>
                </Link>
              </div>
            </div>
          </div>
        ) : user?.role === "hr" ? (
          <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/80 via-blue-950/70 to-slate-950/95 p-6 shadow-2xl backdrop-blur-xl">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-600/20 blur-3xl pointer-events-none" />
            <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-cyan-300 shadow-inner">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                    People & Culture Command Center
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-bold text-teal-400">
                    <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                    Shift Active: 09:00 - 18:00 PKT
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Workforce & Talent Operations
                </h1>
                <p className="text-xs sm:text-sm text-cyan-200/80 max-w-xl">
                  Manage employee onboarding, real-time biometric daily roster, instant leave reviews, and attendance anomaly corrections.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSummarize}
                  disabled={summarizing || !data}
                  className="rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 text-xs font-bold transition shadow-md shadow-cyan-900/40 flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  <span>{summarizing ? "Analyzing HR KPIs..." : "AI HR Summary"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="rounded-xl border border-emerald-400/30 bg-emerald-600/20 px-3.5 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-600/30 transition shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  <span>Executive Report</span>
                </button>
                <Link
                  href="/employees"
                  className="rounded-xl border border-cyan-400/30 bg-cyan-600/20 px-3.5 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-600/30 transition shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                  <span>Onboard Employee</span>
                </Link>
                <Link
                  href="/leaves"
                  className="rounded-xl border border-blue-400/30 bg-blue-600/20 px-3.5 py-2.5 text-xs font-bold text-blue-200 hover:bg-blue-600/30 transition shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <span>Leave Queue →</span>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/80 via-teal-950/70 to-slate-950/95 p-6 shadow-2xl backdrop-blur-xl">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-600/20 blur-3xl pointer-events-none" />
            <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-teal-600/20 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-300 shadow-inner">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    Employee Self-Service Cockpit
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-bold text-teal-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    Biometrics & Remote Ready
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Welcome Back, {user?.name || "Team Member"}!
                </h1>
                <p className="text-xs sm:text-sm text-emerald-200/80 max-w-xl">
                  Your personal career workstation. Check in with live biometric verification (or Remote WFH), submit natural language AI leaves, and inspect payslips.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCameraModalOpen(true)}
                  className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-4 py-2.5 text-xs font-black transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                  <span>{data?.todayAttendance?.checkInAt ? "Biometric Check-In (Recorded ✓)" : "Fast Biometric Check-In"}</span>
                </button>
                <Link
                  href="/leaves"
                  className="rounded-xl border border-teal-400/30 bg-teal-600/20 px-3.5 py-2.5 text-xs font-bold text-teal-200 hover:bg-teal-600/30 transition shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                  <span>✦ Smart AI Leave</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setBadgeOpen(true)}
                  className="rounded-xl border border-teal-400/30 bg-teal-600/20 px-3.5 py-2.5 text-xs font-bold text-teal-200 hover:bg-teal-600/30 transition shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><line x1="15" y1="8" x2="17" y2="8" /><line x1="15" y1="12" x2="17" y2="12" /></svg>
                  <span>Smart ID Badge</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Date & Department Filters for Admin & HR only */}
        {user?.role !== "employee" && (
          <div className="surface-card rounded-xl p-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label htmlFor="dash-start" className="block text-xs font-semibold mb-1">
                Start Date
              </label>
              <input
                id="dash-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="dash-end" className="block text-xs font-semibold mb-1">
                End Date
              </label>
              <input
                id="dash-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="dash-dept" className="block text-xs font-semibold mb-1">
                Department Filter
              </label>
              <select
                id="dash-dept"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="input-field"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setDepartmentId("");
                }}
                className="btn-secondary w-full"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}

        {/* Status Alerts */}
        {toast && (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <span>{toast}</span>
            <button type="button" onClick={() => setToast("")} className="text-xs hover:underline opacity-80">Dismiss</button>
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 p-3.5 text-sm font-medium text-rose-700 dark:text-rose-300 flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="text-xs hover:underline opacity-80">Dismiss</button>
          </div>
        )}

        {/* AI Summary Card */}
        {summaryBullets.length > 0 && (
          <div className="surface-card rounded-2xl border-l-4 border-l-teal-500 p-5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Executive KPI Insights</h2>
              <AiBadge />
            </div>
            <ul className="space-y-1.5 text-sm">
              {summaryBullets.map((b, idx) => (
                <li key={idx} className="leading-relaxed">
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="surface-card h-28 animate-pulse rounded-xl p-4" />
            ))}
          </div>
        ) : data?.role === "admin" ? (
          /* ===================================================================== */
          /* ======================= ADMIN EXCLUSIVE DASHBOARD =================== */
          /* ===================================================================== */
          <div className="space-y-6">
            {/* 1. C-Suite Financial & Workforce KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Active Headcount"
                value={data.kpis.headcount}
                sub={`Present today: ${data.kpis.today?.present ?? 0} · Late: ${data.kpis.today?.late ?? 0}`}
                accent="teal"
              />
              <KpiCard
                label="Monthly Payroll Budget"
                value={`${currency} ${Number(data.kpis.payrollCost || 0).toLocaleString()}`}
                sub={`Attendance rate: ${data.kpis.attendanceRate}%`}
                accent="indigo"
              />
              <KpiCard
                label="Average Gross Salary"
                value={`${currency} ${Number(data.kpis.avgSalary || 0).toLocaleString()}`}
                sub="Mean monthly gross per employee"
                accent="amber"
              />
              <KpiCard
                label="Attrition Rate YTD"
                value={`${data.kpis.attritionRate}%`}
                sub={`Exits in period: ${data.kpis.exitsInPeriod}`}
                accent="rose"
              />
            </div>

            {/* 2. PERMANENT EMPLOYEE REGISTRATION APPROVALS QUEUE */}
            <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-purple-700 dark:text-purple-300 tracking-wide uppercase">
                        Employee Registration Approvals
                      </h2>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${pendingUsers.length > 0 ? "bg-amber-500/20 text-amber-500 animate-pulse" : "bg-emerald-500/20 text-emerald-400"}`}>
                        {pendingUsers.length} Pending
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      Employees registering via the signup page require Admin approval before accessing portal credentials.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadPending()}
                    title="Refresh registration queue"
                    className="rounded-xl border border-default surface-subtle px-3 py-1.5 text-xs font-semibold hover:border-purple-400/50 transition flex items-center gap-1.5 text-muted hover:text-foreground"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                    <span>Refresh</span>
                  </button>
                  <button
                    type="button"
                    disabled={simulatingPending}
                    onClick={handleSimulatePending}
                    className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    <span>{simulatingPending ? "Generating..." : "+ Simulate Registration"}</span>
                  </button>
                </div>
              </div>

              {pendingUsers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    All registered employee accounts are verified. No pending approval requests.
                  </p>
                  <p className="text-[11px] text-muted mt-1">
                    Click <strong>&quot;+ Simulate Registration&quot;</strong> above or register a new user on the signup page to test live approval.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingUsers.map((pu) => (
                    <div
                      key={pu._id}
                      className="rounded-xl border border-default surface-card p-3.5 space-y-2 shadow-xs hover:border-purple-500/40 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground">{pu.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold uppercase">
                          Pending Approval
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-muted truncate">{pu.email}</p>
                      <div className="text-[11px] text-muted flex items-center justify-between pt-0.5">
                        <span>Dept: <strong className="text-foreground">{pu.requestedDepartment || "Engineering"}</strong></span>
                        <span>{pu.requestedPhone || "+92 300 0000000"}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-default/50">
                        <button
                          type="button"
                          disabled={approvingId === pu._id}
                          onClick={() => handleApprove(pu._id)}
                          className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                          <span>{approvingId === pu._id ? "Activating..." : "Approve & Activate"}</span>
                        </button>
                        <button
                          type="button"
                          disabled={approvingId === pu._id}
                          onClick={() => handleReject(pu._id)}
                          className="rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 px-3 py-1.5 text-xs font-bold transition disabled:opacity-50"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Department Headcount & Payroll Cost Distributions */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="surface-card rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold">Headcount by Department</h2>
                  <span className="text-xs text-muted">Total: {data.kpis.headcount}</span>
                </div>
                <HorizontalBars
                  emptyText="No employees registered yet."
                  items={(data.headcountByDepartment || []).map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (d: any) => ({
                      label: d.departmentName,
                      value: d.count,
                      sub: `Avg ${currency} ${Number(d.avgGross || 0).toLocaleString()}`,
                    })
                  )}
                />
              </div>

              <div className="surface-card rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold">Payroll Cost by Department</h2>
                  <span className="text-xs text-muted">Monthly Gross</span>
                </div>
                <HorizontalBars
                  emptyText="No payroll cost data yet."
                  items={(data.payrollByDepartment || []).map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (d: any) => ({
                      label: d.departmentName,
                      value: Number(d.totalGross || 0),
                      sub: `${d.count} active`,
                    })
                  )}
                />
              </div>
            </div>

            {/* 4. Diversity, Attrition Flags & Real-time Audit Trail */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Gender & Tenure Breakdown */}
              <div className="surface-card rounded-2xl p-5 space-y-4">
                <h2 className="text-sm font-bold">Diversity & Tenure Bands</h2>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {Object.entries(data.genderBreakdown || {}).map(([g, cnt]) => (
                    <div key={g} className="surface-subtle rounded-lg p-2.5">
                      <p className="capitalize text-muted">{g}</p>
                      <p className="mt-1 text-lg font-bold">{String(cnt)}</p>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-[var(--border-color)]">
                  <p className="mb-2 text-xs font-semibold text-muted">Tenure Bands</p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="surface-subtle rounded-lg p-2">
                      <p className="text-muted">&lt; 1 yr</p>
                      <p className="font-bold">{data.tenureBreakdown?.under1Year ?? 0}</p>
                    </div>
                    <div className="surface-subtle rounded-lg p-2">
                      <p className="text-muted">1–3 yrs</p>
                      <p className="font-bold">{data.tenureBreakdown?.oneToThreeYears ?? 0}</p>
                    </div>
                    <div className="surface-subtle rounded-lg p-2">
                      <p className="text-muted">3+ yrs</p>
                      <p className="font-bold">{data.tenureBreakdown?.overThreeYears ?? 0}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attrition Risk & Anomaly Flags */}
              <div className="surface-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">Attrition Risk & Anomaly Flags</h2>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    Predictive AI
                  </span>
                </div>
                {(data.attritionRisk || []).length === 0 &&
                (data.anomalyFlags || []).length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">
                    No elevated attrition risks or absence anomalies detected.
                  </p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(data.attritionRisk || []).slice(0, 4).map((r: any) => (
                      <div
                        key={r.employeeId}
                        className="surface-subtle flex items-center justify-between rounded-lg p-2.5"
                      >
                        <div>
                          <p className="font-semibold">
                            {r.fullName} ({r.departmentName})
                          </p>
                          <p className="text-muted">Risk Score: {r.riskScore}/100</p>
                        </div>
                        <StatusPill status={r.riskLevel} />
                      </div>
                    ))}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(data.anomalyFlags || []).slice(0, 3).map((f: any, idx: number) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5"
                      >
                        <p className="font-semibold text-rose-700 dark:text-rose-300">
                          ⚑ {f.fullName}: {f.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Executive Audit Log Feed */}
              <div className="surface-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">Recent System Audit Feed</h2>
                  <Link
                    href="/audit-logs"
                    className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    View all →
                  </Link>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
                  {(data.auditFeed || []).length === 0 ? (
                    <p className="py-4 text-center text-muted">No audit events recorded yet.</p>
                  ) : (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data.auditFeed.map((log: any) => (
                      <div key={log._id} className="surface-subtle rounded-lg p-2.5">
                        <p className="font-semibold text-foreground">{log.summary}</p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {log.actorName} ({log.actorRole}) ·{" "}
                          {new Date(log.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : data?.role === "hr" ? (
          /* ===================================================================== */
          /* ======================= HR EXCLUSIVE DASHBOARD ====================== */
          /* ===================================================================== */
          <div className="space-y-6">
            {/* 1. Operational HR KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard label="Active Headcount" value={data.kpis.headcount} accent="teal" />
              <KpiCard
                label="Present Today"
                value={data.kpis.today?.present ?? 0}
                sub={`Attendance rate: ${data.kpis.attendanceRate}%`}
                accent="teal"
              />
              <KpiCard
                label="On Leave Today"
                value={data.kpis.today?.onLeave ?? 0}
                sub="Approved leave"
                accent="indigo"
              />
              <KpiCard
                label="Late Arrivals Today"
                value={data.kpis.today?.late ?? 0}
                sub={`Late %: ${data.kpis.latePercentage}%`}
                accent="amber"
              />
              <KpiCard
                label="Pending Approvals"
                value={data.kpis.pendingApprovals ?? 0}
                sub={`${data.kpis.pendingLeaves ?? 0} leaves · ${data.kpis.pendingCorrections ?? 0} corrections`}
                accent="rose"
              />
            </div>

            {/* 2. LIVE TODAY ATTENDANCE ROSTER & PENDING LEAVE APPROVALS */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Live Attendance Roster */}
              <div className="surface-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold">Daily Biometric Attendance Roster</h2>
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <Link
                    href="/attendance"
                    className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    View Board →
                  </Link>
                </div>
                {(data.todayAttendanceRoster || []).length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">
                    No employees have checked in yet today.
                  </p>
                ) : (
                  <div className="space-y-2 text-xs max-h-64 overflow-y-auto">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {data.todayAttendanceRoster.map((att: any) => (
                      <div
                        key={att._id}
                        className="surface-subtle flex items-center justify-between rounded-xl p-3 border border-default/40"
                      >
                        <div>
                          <p className="font-bold text-foreground">
                            {att.userId?.name || "Employee"}
                          </p>
                          <p className="text-[11px] text-muted">
                            In: {att.checkInAt ? new Date(att.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A"}{" "}
                            {att.checkOutAt ? `· Out: ${new Date(att.checkOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "· Working"}
                          </p>
                        </div>
                        <StatusPill status={att.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Leave Requests Queue */}
              <div className="surface-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">Pending Leave Approvals Queue</h2>
                  <Link
                    href="/leaves"
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Full Queue →
                  </Link>
                </div>
                {(data.pendingLeaveList || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-teal-500/30 bg-teal-500/5 p-6 text-center">
                    <p className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                      ✓ All leave applications reviewed! No pending requests.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs max-h-64 overflow-y-auto">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {data.pendingLeaveList.map((req: any) => (
                      <div
                        key={req._id}
                        className="surface-subtle rounded-xl p-3 space-y-1.5 border border-default/40"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{req.userId?.name || "Employee"}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-semibold">
                            {req.leaveTypeId?.name || "Leave"} ({req.workingDays}d)
                          </span>
                        </div>
                        <p className="text-[11px] text-muted line-clamp-1">&quot;{req.reason}&quot;</p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-muted">
                            {req.startDate} to {req.endDate}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={reviewingLeaveId === req._id}
                              onClick={() => handleApproveLeave(req._id)}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50"
                            >
                              ✓ Approve
                            </button>
                            <button
                              type="button"
                              disabled={reviewingLeaveId === req._id}
                              onClick={() => handleRejectLeave(req._id)}
                              className="rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50"
                            >
                              ✕ Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Trends & Department Absenteeism */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="surface-card rounded-2xl p-5">
                <h2 className="mb-3 text-sm font-bold">Attendance Trend (Period)</h2>
                <AttendanceTrendSvg points={data.attendanceTrend || []} />
              </div>

              <div className="surface-card rounded-2xl p-5">
                <h2 className="mb-4 text-sm font-bold">Absenteeism % by Department</h2>
                <HorizontalBars
                  emptyText="No department attendance data yet."
                  valueSuffix="%"
                  items={(data.absenteeismByDepartment || []).map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (d: any) => ({
                      label: d.departmentName,
                      value: d.absenteeismRate,
                      sub: `Late: ${d.lateRate}%`,
                    })
                  )}
                />
              </div>
            </div>

            {/* 4. Top Late-Comers, Leave Types & Anomalies */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="surface-card rounded-2xl p-5">
                <h2 className="mb-4 text-sm font-bold">Leave Utilization by Type</h2>
                <HorizontalBars
                  emptyText="No approved leaves yet."
                  items={(data.leaveByType || []).map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (l: any) => ({
                      label: l.name,
                      value: l.approvedDays,
                      sub:
                        l.utilizationPercent !== null
                          ? `${l.utilizationPercent}% quota`
                          : "Unlimited",
                    })
                  )}
                />
              </div>

              <div className="surface-card rounded-2xl p-5">
                <h2 className="mb-3 text-sm font-bold">Top 5 Late-Comers</h2>
                {(data.topLateComers || []).length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">
                    No late arrivals recorded in this period.
                  </p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {data.topLateComers.map((c: any, idx: number) => (
                      <div
                        key={c.employeeId}
                        className="surface-subtle flex items-center justify-between rounded-lg p-2.5"
                      >
                        <div>
                          <p className="font-semibold">
                            #{idx + 1} {c.fullName}
                          </p>
                          <p className="text-muted">
                            {c.departmentName} · {c.totalLateMinutes} min total
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-bold text-amber-700 dark:text-amber-300">
                          {c.lateCount}x late
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="surface-card rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-bold">Anomaly Flags & Attrition Risk</h2>
                {(data.anomalyFlags || []).length === 0 &&
                (data.attritionRisk || []).length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">
                    All attendance patterns look healthy.
                  </p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(data.anomalyFlags || []).map((f: any, i: number) => (
                      <div
                        key={i}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5"
                      >
                        <p className="font-semibold text-rose-700 dark:text-rose-300">
                          ⚑ {f.fullName} ({f.departmentName})
                        </p>
                        <p className="text-muted">{f.reason}</p>
                      </div>
                    ))}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(data.attritionRisk || []).slice(0, 3).map((r: any) => (
                      <div
                        key={r.employeeId}
                        className="surface-subtle flex items-center justify-between rounded-lg p-2.5"
                      >
                        <span>
                          {r.fullName} · Score {r.riskScore}
                        </span>
                        <StatusPill status={r.riskLevel} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ===================================================================== */
          /* ================== EMPLOYEE SELF-SERVICE DASHBOARD ================== */
          /* ===================================================================== */
          <div className="space-y-6">
            {/* 1. Check-In / Check-Out Hero Card */}
            <div className="surface-card rounded-2xl p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border border-emerald-500/30">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold">
                    Today&apos;s Attendance ({data?.todayStr})
                  </h2>
                  {data?.todayAttendance && <StatusPill status={data.todayAttendance.status} />}
                </div>
                <p className="mt-1 text-xs text-muted">
                  Office Hours: <strong>{data?.officeHours}</strong> ·{" "}
                  {data?.todayAttendance?.checkInAt
                    ? `Checked in at ${new Date(data.todayAttendance.checkInAt).toLocaleTimeString(
                        [],
                        { hour: "2-digit", minute: "2-digit" }
                      )}${
                        data.todayAttendance.checkOutAt
                          ? ` · Checked out (${data.todayAttendance.workedHours}h)`
                          : ""
                      }`
                    : "You have not checked in yet today."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {!data?.todayAttendance ? (
                  <>
                    <button
                      type="button"
                      disabled={checkingInOut}
                      onClick={handleWebCheckIn}
                      className="btn-primary"
                    >
                      ⏱ Web Check-In
                    </button>
                    <button
                      type="button"
                      disabled={checkingInOut}
                      onClick={() => setCameraModalOpen(true)}
                      className="btn-secondary"
                    >
                      📷 Camera + GPS Check-In
                    </button>
                  </>
                ) : !data.todayAttendance.checkOutAt ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={checkingInOut}
                      onClick={handleWebCheckOut}
                      className="btn-primary"
                    >
                      ⏹ Web Check-Out
                    </button>
                    <button
                      type="button"
                      onClick={() => setCameraModalOpen(true)}
                      className="btn-secondary text-xs"
                      title="Test camera scan again"
                    >
                      📷 Test Face Scan Again
                    </button>
                  </div>
                ) : (
                  <span className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    ✓ Day Completed ({data.todayAttendance.workedHours}h)
                  </span>
                )}
              </div>
            </div>

            {/* 2. Gamification: 18-Day Attendance Streak & Kudos Recognition */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Flame Streak Card */}
              <div className="surface-card rounded-2xl border border-amber-500/30 p-5 space-y-3 relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-2xl animate-bounce">
                      🔥
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-amber-600 dark:text-amber-400">
                        18-Day On-Time Streak!
                      </h3>
                      <p className="text-[11px] text-muted">Rank: Punctuality Champion 🌟</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
                    +250 XP
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted font-semibold">
                    <span>Progress to Monthly 20-Day Bonus Shield</span>
                    <span>18 / 20 Days (90%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full w-[90%]" />
                  </div>
                </div>
                <p className="text-[11px] text-muted">
                  Keep checking in before 09:15 AM to unlock the Saylani Tech Annual Punctuality Reward!
                </p>
              </div>

              {/* Peer Kudos Recognition */}
              <div className="surface-card rounded-2xl border border-teal-500/30 p-5 space-y-3 bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-transparent shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/20 text-2xl">
                      ⭐
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-teal-600 dark:text-teal-400">
                        Workforce Kudos & Recognition
                      </h3>
                      <p className="text-[11px] text-muted">October 2026 Peer Spotlight</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playKudos();
                      triggerConfetti(2500);
                      setToast("⭐ Kudos sent to teammates!");
                    }}
                    className="rounded-lg bg-teal-600 px-3 py-1 text-xs font-bold text-white hover:bg-teal-500 transition shadow-sm"
                  >
                    + Send Kudos
                  </button>
                </div>
                <div className="surface-subtle rounded-xl p-3 text-xs space-y-1 border border-default">
                  <p className="font-bold text-foreground">
                    &quot;Great job on launching the biometric attendance module ahead of time!&quot;
                  </p>
                  <p className="text-[10px] text-muted">From HR Fatima Khan • 2 hours ago</p>
                </div>
              </div>
            </div>

            {/* 3. Personal KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="surface-card rounded-xl border-t-4 border-t-teal-500 p-4">
                <p className="text-xs font-semibold uppercase text-muted">Hours This Week vs 40h</p>
                <p className="mt-1.5 text-2xl font-bold">
                  {data?.kpis?.hoursThisWeek ?? 0}h{" "}
                  <span className="text-sm font-normal text-muted">/ 40h</span>
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{
                      width: `${Math.min(100, ((data?.kpis?.hoursThisWeek || 0) / 40) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <KpiCard
                label="Late Count (This Month)"
                value={data?.kpis?.lateCountThisMonth ?? 0}
                sub="Every 3 lates = 0.5 day rule if enabled"
                accent="amber"
              />
              <KpiCard
                label="Paid Leave Days Left"
                value={data?.kpis?.totalLeaveRemaining ?? 0}
                sub="Combined annual, sick & casual remaining"
                accent="indigo"
              />
            </div>

            {/* 4. Leave Balances + Last Payslip */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="surface-card rounded-2xl p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold">My Leave Balances</h2>
                  <Link
                    href="/leaves"
                    className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    Smart Leave →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(data?.leaveBalances || []).map((b: any) => (
                    <div key={b.leaveTypeId} className="surface-subtle rounded-xl p-3">
                      <p className="font-semibold">{b.name}</p>
                      <p className="mt-1 text-lg font-bold">
                        {b.isUnlimited ? "Unlimited" : `${b.remaining} / ${b.quota}`}
                      </p>
                      <p className="text-muted">Used: {b.approvedDays}d</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-card rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold">Latest Payslip</h2>
                    <Link
                      href="/payroll"
                      className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      All Payslips →
                    </Link>
                  </div>
                  {!data?.lastPayslip ? (
                    <p className="py-6 text-center text-xs text-muted">
                      No monthly payslip generated yet.
                    </p>
                  ) : (
                    <div className="surface-subtle rounded-xl p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">
                          Period: {data.lastPayslip.month}/{data.lastPayslip.year}
                        </span>
                        <StatusPill status={data.lastPayslip.status} />
                      </div>
                      <p className="text-muted">
                        Gross: {currency} {Number(data.lastPayslip.proratedGross).toLocaleString()} ·
                        Tax: {currency} {Number(data.lastPayslip.monthlyTax).toLocaleString()}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
                        <span className="text-base font-bold text-teal-600 dark:text-teal-400">
                          Net: {currency} {Number(data.lastPayslip.netPay).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            void downloadPayslipPdf(
                              data.lastPayslip._id,
                              data.lastPayslip.employeeSnapshot?.employeeCode,
                              data.lastPayslip.year,
                              data.lastPayslip.month
                            )
                          }
                          className="btn-primary py-1.5 px-3 text-xs"
                        >
                          ⬇ PDF Payslip
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Announcements Strip on ALL Dashboards */}
        {!loading && data && (
          <div className="surface-card rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold">Company Announcements</h2>
              <Link
                href="/announcements"
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
              >
                {user?.role === "employee" ? "View all →" : "Post / Manage →"}
              </Link>
            </div>
            {(data.announcements || []).length === 0 ? (
              <p className="text-xs text-muted">No announcements posted yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {data.announcements.map((a: any) => (
                  <div key={a._id} className="surface-subtle rounded-xl p-3.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold">{a.title}</p>
                      <StatusPill status={a.priority} />
                    </div>
                    <p className="mt-1 text-muted line-clamp-2">{a.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CameraCheckInModal
        open={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        hasEnrolledFace={user?.hasEnrolledFace}
        onSuccess={(msg) => {
          setToast(msg);
          void loadDashboard();
        }}
        onFallbackCorrection={() => router.push("/attendance")}
      />

      <ExecutiveReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        dashboardData={data}
        companyName={data?.companyName || "Saylani Tech"}
        currency={currency}
      />

      <DigitalEmployeeBadge
        open={badgeOpen}
        onClose={() => setBadgeOpen(false)}
        employeeData={{
          fullName: user?.name,
          email: user?.email,
          employeeCode: "EMP001",
          designation: "Senior Software Engineer",
          department: "Engineering",
          bloodGroup: "O+",
          joiningDate: "2026-01-15",
        }}
        companyName={data?.companyName || "Saylani Tech"}
      />
    </AppShell>
  );
}

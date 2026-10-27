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

  // Pending Self-Registrations state (Admin & HR)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

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
        {/* Dynamic VIP Animated Role Banners */}
        {user?.role === "admin" ? (
          <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-950/75 via-indigo-950/60 to-slate-950/90 p-6 shadow-2xl backdrop-blur-xl">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-purple-600/20 blur-3xl pointer-events-none" />
            <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/40 bg-purple-500/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-purple-300 shadow-inner">
                    <span className="animate-spin text-sm">✦</span> C-Level Executive Command
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    Enterprise Core Active
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Saylani Tech Executive Suite
                </h1>
                <p className="text-xs sm:text-sm text-purple-200/80 max-w-xl">
                  Strategic governance across Headcount, Multi-Slab Tax Payroll, Biometric Geofencing, and Immutable Security Audits.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSummarize}
                  disabled={summarizing || !data}
                  className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 text-xs font-bold transition shadow-md shadow-purple-900/40 flex items-center gap-1.5"
                >
                  <span>✦</span>
                  <span>{summarizing ? "Analyzing KPIs..." : "AI Executive Brief"}</span>
                </button>
                <Link
                  href="/organization"
                  className="rounded-xl border border-purple-400/30 bg-purple-600/20 px-3.5 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-600/30 transition shadow-sm"
                >
                  ⚙️ Company Rules
                </Link>
                <Link
                  href="/payroll"
                  className="rounded-xl border border-indigo-400/30 bg-indigo-600/20 px-3.5 py-2.5 text-xs font-bold text-indigo-200 hover:bg-indigo-600/30 transition shadow-sm"
                >
                  💰 Finalize Payroll →
                </Link>
              </div>
            </div>
          </div>
        ) : user?.role === "hr" ? (
          <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/75 via-blue-950/60 to-slate-950/90 p-6 shadow-2xl backdrop-blur-xl">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-600/20 blur-3xl pointer-events-none" />
            <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-cyan-300 shadow-inner">
                    <span>💼</span> People & Culture Command Center
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-bold text-teal-400">
                    <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                    Shift Active: 09:00 - 18:00
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Workforce & Talent Operations
                </h1>
                <p className="text-xs sm:text-sm text-cyan-200/80 max-w-xl">
                  Manage employee onboarding, real-time biometric daily board, smart leave reviews, and monthly payroll calculation drafts.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSummarize}
                  disabled={summarizing || !data}
                  className="rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 text-xs font-bold transition shadow-md shadow-cyan-900/40 flex items-center gap-1.5"
                >
                  <span>✦</span>
                  <span>{summarizing ? "Analyzing HR KPIs..." : "AI HR Summary"}</span>
                </button>
                <Link
                  href="/employees"
                  className="rounded-xl border border-cyan-400/30 bg-cyan-600/20 px-3.5 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-600/30 transition shadow-sm"
                >
                  👥 Onboard Employee
                </Link>
                <Link
                  href="/leaves"
                  className="rounded-xl border border-blue-400/30 bg-blue-600/20 px-3.5 py-2.5 text-xs font-bold text-blue-200 hover:bg-blue-600/30 transition shadow-sm"
                >
                  🏖️ Leave Queue →
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/75 via-teal-950/60 to-slate-950/90 p-6 shadow-2xl backdrop-blur-xl">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-600/20 blur-3xl pointer-events-none" />
            <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-teal-600/20 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-300 shadow-inner">
                    <span>👤</span> Employee Self-Service Cockpit
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
                  <span>📸</span> {data?.todayAttendance?.checkInAt ? "Biometric Check-In (Recorded ✓)" : "Fast Biometric Check-In"}
                </button>
                <Link
                  href="/leaves"
                  className="rounded-xl border border-teal-400/30 bg-teal-600/20 px-3.5 py-2.5 text-xs font-bold text-teal-200 hover:bg-teal-600/30 transition shadow-sm"
                >
                  ✦ Smart AI Leave
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Pending Self-Registrations Alert Card (For Admin & HR) */}
        {pendingUsers.length > 0 && (user?.role === "admin" || user?.role === "hr") && (
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-transparent p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-lg">
                  ⏳
                </span>
                <div>
                  <h2 className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    Pending Employee Registrations ({pendingUsers.length})
                  </h2>
                  <p className="text-xs text-muted">
                    New employees registered via signup page. Review and approve to activate their portal access.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                Action Required
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {pendingUsers.map((pu) => (
                <div
                  key={pu._id}
                  className="rounded-xl border border-default surface-card p-3.5 space-y-2 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{pu.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold uppercase">
                      Pending
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-muted">{pu.email}</p>
                  <div className="text-[11px] text-muted flex items-center justify-between">
                    <span>Dept: {pu.requestedDepartment || "General"}</span>
                    <span>{pu.requestedPhone || "No phone"}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-default/50">
                    <button
                      type="button"
                      disabled={approvingId === pu._id}
                      onClick={() => handleApprove(pu._id)}
                      className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 text-xs font-bold transition shadow-xs disabled:opacity-50"
                    >
                      {approvingId === pu._id ? "Approving..." : "✓ Approve"}
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
          </div>
        )}

        {/* Date & Department Filters for Admin & HR */}
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

        {toast && (
          <div className="rounded-xl bg-emerald-500/15 p-3.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            {toast}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-rose-500/15 p-3.5 text-sm font-medium text-rose-700 dark:text-rose-300">
            {error}
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
          /* ===================== ADMIN DASHBOARD ===================== */
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Active Headcount"
                value={data.kpis.headcount}
                sub={`Present today: ${data.kpis.today?.present ?? 0} · Late: ${data.kpis.today?.late ?? 0}`}
                accent="teal"
              />
              <KpiCard
                label="Attrition YTD"
                value={`${data.kpis.attritionRate}%`}
                sub={`Exits in period: ${data.kpis.exitsInPeriod}`}
                accent="rose"
              />
              <KpiCard
                label="Monthly Payroll Cost"
                value={`${currency} ${Number(data.kpis.payrollCost || 0).toLocaleString()}`}
                sub={`Attendance rate: ${data.kpis.attendanceRate}%`}
                accent="indigo"
              />
              <KpiCard
                label="Average Gross Salary"
                value={`${currency} ${Number(data.kpis.avgSalary || 0).toLocaleString()}`}
                sub="Mean gross across active workforce"
                accent="amber"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="surface-card rounded-2xl p-5">
                <h2 className="mb-4 text-sm font-bold">Headcount by Department</h2>
                <HorizontalBars
                  emptyText="No employees registered yet. Ask HR to register employees."
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
                <h2 className="mb-4 text-sm font-bold">Payroll Cost by Department</h2>
                <HorizontalBars
                  emptyText="No payroll cost data yet."
                  items={(data.payrollByDepartment || []).map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (d: any) => ({
                      label: d.departmentName,
                      value: Number(d.totalGross || 0),
                      sub: `${d.count} emp`,
                    })
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Gender & Tenure */}
              <div className="surface-card rounded-2xl p-5 space-y-4">
                <h2 className="text-sm font-bold">Gender & Tenure Distribution</h2>
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

              {/* Bonus: Attrition Risk & Absence Anomaly Flags */}
              <div className="surface-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">Attrition Risk & Anomaly Flags</h2>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    Bonus Analytics
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

              {/* Recent Audit Feed */}
              <div className="surface-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">Recent Audit Feed</h2>
                  <Link
                    href="/audit-logs"
                    className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
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
                        <p className="font-semibold">{log.summary}</p>
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
          /* ===================== HR DASHBOARD ===================== */
          <div className="space-y-6">
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
                sub="Approved leaves"
                accent="indigo"
              />
              <KpiCard
                label="Late Today"
                value={data.kpis.today?.late ?? 0}
                sub={`Period late %: ${data.kpis.latePercentage}%`}
                accent="amber"
              />
              <KpiCard
                label="Pending Approvals"
                value={data.kpis.pendingApprovals ?? 0}
                sub={`${data.kpis.pendingLeaves ?? 0} leaves · ${data.kpis.pendingCorrections ?? 0} corrections`}
                accent="rose"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="surface-card rounded-2xl p-5">
                <h2 className="mb-3 text-sm font-bold">Attendance Trend</h2>
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
                          ? `${l.utilizationPercent}% of quota`
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
          /* ===================== EMPLOYEE SELF-SERVICE DASHBOARD ===================== */
          <div className="space-y-6">
            {/* Check-In / Check-Out Hero Card */}
            <div className="surface-card rounded-2xl p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

            {/* KPIs */}
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

            {/* Leave Balance + Last Payslip */}
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

        {/* Announcements Strip on ALL Dashboards (#23) */}
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
    </AppShell>
  );
}

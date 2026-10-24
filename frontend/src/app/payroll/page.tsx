"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import {
  downloadPayslipPdf,
  finalizePayrollRunApi,
  generatePayrollDraftApi,
  getPayrollRunByIdApi,
  listPayrollRunsApi,
  listPayslipsApi,
  PayslipRecord,
} from "@/api/hcm";
import { getApiErrorMessage } from "@/lib/api";
import { KpiCard, StatusPill } from "@/components/Charts";

export default function PayrollPage() {
  const { user, currency } = useAuth();
  const isAdmin = user?.role === "admin";
  const isHr = user?.role === "hr";
  const isEmployee = user?.role === "employee";

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [runs, setRuns] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setError("");
    try {
      if (isEmployee) {
        const mySlips = await listPayslipsApi();
        setPayslips(mySlips);
      } else {
        const allRuns = await listPayrollRunsApi();
        setRuns(allRuns);
        if (allRuns.length > 0) {
          const detail = await getPayrollRunByIdApi(allRuns[0]._id);
          setSelectedRun(detail.payrollRun);
          setPayslips(detail.payslips);
        } else {
          setSelectedRun(null);
          setPayslips([]);
        }
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [isEmployee]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSelectRun = async (runId: string) => {
    try {
      const detail = await getPayrollRunByIdApi(runId);
      setSelectedRun(detail.payrollRun);
      setPayslips(detail.payslips);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {isEmployee ? "My Monthly Payslips" : "Monthly Payroll & Payslip PDFs"}
            </h1>
            <p className="text-xs text-muted">
              {isEmployee
                ? "View your salary breakdown, attendance deductions, tax slab calculations, and download official PDF payslips."
                : "HR prepares & recalculates monthly drafts · Admin finalizes and locks the month · Official PDF payslips."}
            </p>
          </div>

          {/* #15 HR Generates / Recalculates Monthly Draft */}
          {isHr && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                aria-label="Payroll month"
                className="input-field w-32"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    Month {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                aria-label="Payroll year"
                className="input-field w-28"
              />
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const res = await generatePayrollDraftApi({ month, year });
                    setToast(res.message);
                    await loadData();
                  } catch (err) {
                    setError(getApiErrorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="btn-primary"
              >
                {busy ? "Calculating..." : "⚡ Prepare / Refresh Payroll Draft"}
              </button>
            </div>
          )}
        </div>

        {toast && (
          <div className="rounded-xl bg-emerald-500/15 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {toast}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-rose-500/15 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Admin & HR Payroll Run Selector & Finalize Action (#16) */}
        {!isEmployee && runs.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 surface-card rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-muted">Payroll Runs:</span>
                {runs.map((r) => (
                  <button
                    key={r._id}
                    type="button"
                    onClick={() => void handleSelectRun(r._id)}
                    className={
                      selectedRun?._id === r._id
                        ? "btn-primary py-1.5 px-3 text-xs"
                        : "btn-secondary py-1.5 px-3 text-xs"
                    }
                  >
                    {r.month}/{r.year} ({r.status})
                  </button>
                ))}
              </div>

              {isAdmin && selectedRun?.status === "draft" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const res = await finalizePayrollRunApi(selectedRun._id);
                      setToast(res.message);
                      await loadData();
                    } catch (err) {
                      setError(getApiErrorMessage(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="btn-primary bg-indigo-600 hover:bg-indigo-700"
                >
                  🔒 Finalize & Lock {selectedRun.month}/{selectedRun.year} Payroll
                </button>
              )}

              {selectedRun?.status === "finalized" && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  🔒 Locked & Finalized by Admin
                </span>
              )}
            </div>

            {selectedRun && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <KpiCard
                  label="Employees Paid"
                  value={selectedRun.totalEmployees}
                  sub={`Working days: ${selectedRun.workingDaysInMonth}`}
                  accent="teal"
                />
                <KpiCard
                  label="Total Prorated Gross"
                  value={`${currency} ${Number(selectedRun.totalGross).toLocaleString()}`}
                  accent="indigo"
                />
                <KpiCard
                  label="Attendance Deductions"
                  value={`${currency} ${Number(selectedRun.totalDeductions).toLocaleString()}`}
                  sub={`Monthly Income Tax: ${currency} ${Number(selectedRun.totalTax).toLocaleString()}`}
                  accent="amber"
                />
                <KpiCard
                  label="Total Net Payable"
                  value={`${currency} ${Number(selectedRun.totalNet).toLocaleString()}`}
                  accent="teal"
                />
              </div>
            )}
          </div>
        )}

        {/* Payslips Table with Official PDF Download (#17) */}
        <div className="table-wrapper">
          <table
            className="stack-table"
            style={
              {
                "--label-2": '"Period"',
                "--label-3": '"Prorated Gross"',
                "--label-4": '"Deductions & Tax"',
                "--label-5": '"Net Pay"',
                "--label-6": '"Status"',
                "--label-7": '"PDF"',
              } as React.CSSProperties
            }
          >
            <thead>
              <tr>
                <th>Employee</th>
                <th>Period</th>
                <th>Prorated Gross</th>
                <th>Deductions & Tax</th>
                <th>Net Pay</th>
                <th>Status</th>
                <th>Payslip PDF</th>
              </tr>
            </thead>
            <tbody>
              {payslips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    {isEmployee
                      ? "No payslips generated for your account yet."
                      : "No payroll run generated yet. HR can click 'Prepare / Refresh Payroll Draft' above."}
                  </td>
                </tr>
              ) : (
                payslips.map((p) => (
                  <tr key={p._id}>
                    <th>
                      <div>
                        <p>{p.employeeSnapshot?.fullName}</p>
                        <p className="text-xs font-normal text-muted">
                          {p.employeeSnapshot?.employeeCode} · {p.employeeSnapshot?.departmentName}
                        </p>
                      </div>
                    </th>
                    <td className="font-mono">
                      {p.month}/{p.year}
                    </td>
                    <td className="font-mono">
                      {currency} {Number(p.proratedGross).toLocaleString()}
                    </td>
                    <td className="text-xs">
                      <p>
                        Att. Ded: {currency} {Number(p.attendanceDeduction).toLocaleString()} (
                        {p.deductibleDays}d)
                      </p>
                      <p className="text-muted">
                        Tax: {currency} {Number(p.monthlyTax).toLocaleString()}
                      </p>
                    </td>
                    <td className="font-mono font-bold text-teal-600 dark:text-teal-400">
                      {currency} {Number(p.netPay).toLocaleString()}
                    </td>
                    <td>
                      <StatusPill status={p.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          void downloadPayslipPdf(
                            p._id,
                            p.employeeSnapshot?.employeeCode,
                            p.year,
                            p.month
                          )
                        }
                        className="btn-primary py-1.5 px-3 text-xs"
                      >
                        ⬇ Download PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}


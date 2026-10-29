"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import {
  checkInApi,
  checkOutApi,
  Department,
  EmployeeRecord,
  exportAttendanceCsvDownload,
  getAttendanceCalendarApi,
  getDailyBoardApi,
  listCorrectionsApi,
  listDepartmentsApi,
  listEmployeesApi,
  requestCorrectionApi,
  reviewCorrectionApi,
} from "@/api/hcm";
import { getApiErrorMessage } from "@/lib/api";
import { StatusPill } from "@/components/Charts";
import CameraCheckInModal from "@/components/CameraCheckInModal";
import ModalDialog from "@/components/ModalDialog";

export default function AttendancePage() {
  const { user } = useAuth();
  const isStaff = user?.role === "hr" || user?.role === "employee";
  const isManager = user?.role === "admin" || user?.role === "hr";
  const isHr = user?.role === "hr";

  const now = new Date();
  const [tab, setTab] = useState<"calendar" | "board" | "corrections">(
    user?.role === "admin" ? "board" : "calendar"
  );

  // Calendar state
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [calendarData, setCalendarData] = useState<any>(null);

  // Daily Board state (Admin/HR)
  const [boardDate, setBoardDate] = useState(now.toISOString().slice(0, 10));
  const [boardDeptId, setBoardDeptId] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [boardData, setBoardData] = useState<any>(null);

  // Corrections state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [corrections, setCorrections] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);

  // Modals
  const [cameraOpen, setCameraOpen] = useState(false);
  const [corrOpen, setCorrOpen] = useState(false);
  const [corrDate, setCorrDate] = useState(now.toISOString().slice(0, 10));
  const [corrIn, setCorrIn] = useState("09:00");
  const [corrOut, setCorrOut] = useState("18:00");
  const [corrReason, setCorrReason] = useState("");

  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setError("");
    try {
      const [cal, corrs] = await Promise.all([
        getAttendanceCalendarApi({
          year: calYear,
          month: calMonth,
          employeeId: selectedEmpId || undefined,
        }),
        listCorrectionsApi(),
      ]);
      setCalendarData(cal);
      setCorrections(corrs);

      if (isManager) {
        const [b, depts, empRes] = await Promise.all([
          getDailyBoardApi({
            date: boardDate,
            departmentId: boardDeptId || undefined,
          }),
          listDepartmentsApi(),
          listEmployeesApi({ limit: 100 }),
        ]);
        setBoardData(b);
        setDepartments(depts);
        setEmployees(empRes.employees);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [calYear, calMonth, selectedEmpId, boardDate, boardDeptId, isManager]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCheckIn = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await checkInApi({ source: "web" });
      setToast(res.message);
      await loadAll();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCheckOut = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await checkOutApi();
      setToast(res.message);
      await loadAll();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Bar with Check-In / Out Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Attendance & Geofence</h1>
            <p className="text-xs text-muted">
              Server-stamped check-in/out · Late after grace · Half-day under threshold · Camera +
              GPS Haversine verification.
            </p>
          </div>

          {isStaff && (
            <div className="flex flex-wrap gap-2">
              {!calendarData?.todayRecord ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCheckIn}
                    className="btn-primary"
                  >
                    ⏱ Web Check-In
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setCameraOpen(true)}
                    className="btn-secondary"
                  >
                    📷 Camera Check-In
                  </button>
                </>
              ) : !calendarData.todayRecord.checkOutAt ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCheckOut}
                  className="btn-primary"
                >
                  ⏹ Web Check-Out
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setCorrOpen(true)}
                className="btn-secondary"
              >
                + Request Correction
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[var(--border-color)] pb-3">
          <button
            type="button"
            onClick={() => setTab("calendar")}
            className={tab === "calendar" ? "btn-primary text-xs" : "btn-secondary text-xs"}
          >
            Monthly Calendar
          </button>
          {isManager && (
            <button
              type="button"
              onClick={() => setTab("board")}
              className={tab === "board" ? "btn-primary text-xs" : "btn-secondary text-xs"}
            >
              Daily Attendance Board
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab("corrections")}
            className={tab === "corrections" ? "btn-primary text-xs" : "btn-secondary text-xs"}
          >
            Corrections ({corrections.filter((c) => c.status === "pending").length} pending)
          </button>
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

        {/* TAB 1: MONTHLY ATTENDANCE CALENDAR (#10) */}
        {tab === "calendar" && (
          <div className="space-y-4">
            <div className="surface-card rounded-xl p-4 flex flex-wrap items-center gap-3">
              <select
                value={calMonth}
                onChange={(e) => setCalMonth(Number(e.target.value))}
                aria-label="Select month"
                className="input-field max-w-36"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    Month {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={calYear}
                onChange={(e) => setCalYear(Number(e.target.value))}
                aria-label="Select year"
                className="input-field max-w-28"
              />
              {isManager && (
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  aria-label="Select employee"
                  className="input-field max-w-xs"
                >
                  <option value="">My Own Attendance</option>
                  {employees.map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.fullName} ({e.employeeCode})
                    </option>
                  ))}
                </select>
              )}
              {isManager && (
                <button
                  type="button"
                  onClick={() => void exportAttendanceCsvDownload(undefined, calMonth, calYear)}
                  className="btn-secondary text-xs flex items-center gap-1.5 shrink-0"
                  title="Download Monthly Attendance CSV"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  <span>Export CSV</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
              {(calendarData?.days || []).map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (d: any) => (
                  <div key={d.date} className="surface-card rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold">{d.date.slice(8)}</span>
                      <StatusPill status={d.status} />
                    </div>
                    {d.checkInAt && (
                      <p className="text-[11px] text-muted">
                        In:{" "}
                        {new Date(d.checkInAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {d.source === "camera" ? " 📷" : ""}
                      </p>
                    )}
                    {d.checkOutAt && (
                      <p className="text-[11px] text-muted">
                        Out:{" "}
                        {new Date(d.checkOutAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        ({d.workedHours}h)
                      </p>
                    )}
                    {d.label && <p className="text-[11px] font-medium text-teal-600">{d.label}</p>}
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DAILY ATTENDANCE BOARD (#10 Admin/HR) */}
        {tab === "board" && isManager && (
          <div className="space-y-4">
            <div className="surface-card rounded-xl p-4 flex flex-wrap gap-3">
              <input
                type="date"
                value={boardDate}
                onChange={(e) => setBoardDate(e.target.value)}
                aria-label="Board date"
                className="input-field max-w-48"
              />
              <select
                value={boardDeptId}
                onChange={(e) => setBoardDeptId(e.target.value)}
                aria-label="Department filter"
                className="input-field max-w-xs"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void exportAttendanceCsvDownload(boardDate)}
                className="btn-secondary text-xs flex items-center gap-1.5 shrink-0"
                title="Download Daily Board Attendance CSV"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                <span>Export Daily CSV</span>
              </button>
            </div>

            {boardData?.counts && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 text-center text-xs">
                {[
                  { label: "Present", val: boardData.counts.present },
                  { label: "Late", val: boardData.counts.late },
                  { label: "Half Day", val: boardData.counts.halfDay },
                  { label: "Missing Out", val: boardData.counts.missingCheckout },
                  { label: "On Leave", val: boardData.counts.onLeave },
                  { label: "Absent", val: boardData.counts.absent },
                ].map((c) => (
                  <div key={c.label} className="surface-card rounded-xl p-3">
                    <p className="text-muted">{c.label}</p>
                    <p className="mt-1 text-xl font-bold">{c.val}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="table-wrapper">
              <table
                className="stack-table"
                style={
                  {
                    "--label-2": '"Department"',
                    "--label-3": '"Check In / Out"',
                    "--label-4": '"Source"',
                    "--label-5": '"Status"',
                  } as React.CSSProperties
                }
              >
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Check In / Out</th>
                    <th>Source</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(boardData?.board || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted">
                        No active employees found for this date.
                      </td>
                    </tr>
                  ) : (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    boardData.board.map((row: any) => (
                      <tr key={row.employeeId}>
                        <th>
                          {row.fullName}{" "}
                          <span className="font-mono text-xs text-muted">({row.employeeCode})</span>
                        </th>
                        <td>{row.departmentName}</td>
                        <td className="font-mono text-xs">
                          {row.checkInAt
                            ? `${new Date(row.checkInAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })} → ${
                                row.checkOutAt
                                  ? new Date(row.checkOutAt).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"
                              }`
                            : "—"}
                        </td>
                        <td className="text-xs">
                          {row.source
                            ? `${row.source}${
                                row.distanceMeters !== null ? ` (${row.distanceMeters}m)` : ""
                              }`
                            : "—"}
                        </td>
                        <td>
                          <StatusPill status={row.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ATTENDANCE CORRECTIONS (#11) */}
        {tab === "corrections" && (
          <div className="table-wrapper">
            <table
              className="stack-table"
              style={
                {
                  "--label-2": '"Date"',
                  "--label-3": '"Requested Times"',
                  "--label-4": '"Reason"',
                  "--label-5": '"Status"',
                  "--label-6": '"Action"',
                } as React.CSSProperties
              }
            >
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Requested Times</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {corrections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted">
                      No attendance correction requests submitted.
                    </td>
                  </tr>
                ) : (
                  corrections.map((c) => (
                    <tr key={c._id}>
                      <th>{c.employeeId?.fullName || c.userId?.name || "Employee"}</th>
                      <td className="font-mono">{c.date}</td>
                      <td className="font-mono">
                        {c.requestedCheckIn} – {c.requestedCheckOut}
                      </td>
                      <td>{c.reason}</td>
                      <td>
                        <StatusPill status={c.status} />
                      </td>
                      <td>
                        {isHr && c.status === "pending" ? (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await reviewCorrectionApi(c._id, {
                                  decision: "approved",
                                  comment: "Verified by HR",
                                });
                                setToast("Correction approved and attendance updated!");
                                void loadAll();
                              }}
                              className="btn-primary py-1 px-2.5 text-xs"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await reviewCorrectionApi(c._id, {
                                  decision: "rejected",
                                  comment: "Declined",
                                });
                                setToast("Correction rejected");
                                void loadAll();
                              }}
                              className="btn-secondary py-1 px-2.5 text-xs text-rose-600"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">{c.reviewComment || "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Camera Check-In Modal */}
      <CameraCheckInModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        hasEnrolledFace={user?.hasEnrolledFace}
        onSuccess={(msg) => {
          setToast(msg);
          void loadAll();
        }}
        onFallbackCorrection={() => setCorrOpen(true)}
      />

      {/* Request Attendance Correction Modal */}
      <ModalDialog
        open={corrOpen}
        onClose={() => setCorrOpen(false)}
        title="Request Attendance Correction"
        subtitle="Submit missed check-out or offsite attendance for HR approval"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              const res = await requestCorrectionApi({
                date: corrDate,
                requestedCheckIn: corrIn,
                requestedCheckOut: corrOut,
                reason: corrReason,
              });
              setToast(res.message);
              setCorrReason("");
              setCorrOpen(false);
              setTab("corrections");
              void loadAll();
            } catch (err) {
              setError(getApiErrorMessage(err));
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="cr-date" className="block text-xs font-semibold mb-1">
                Date *
              </label>
              <input
                id="cr-date"
                type="date"
                required
                value={corrDate}
                onChange={(e) => setCorrDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="cr-in" className="block text-xs font-semibold mb-1">
                Check-In *
              </label>
              <input
                id="cr-in"
                type="time"
                required
                value={corrIn}
                onChange={(e) => setCorrIn(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="cr-out" className="block text-xs font-semibold mb-1">
                Check-Out *
              </label>
              <input
                id="cr-out"
                type="time"
                required
                value={corrOut}
                onChange={(e) => setCorrOut(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label htmlFor="cr-reason" className="block text-xs font-semibold mb-1">
              Reason *
            </label>
            <textarea
              id="cr-reason"
              rows={3}
              required
              placeholder="e.g. Client visit / GPS indoor accuracy issue / Forgot evening check-out"
              value={corrReason}
              onChange={(e) => setCorrReason(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCorrOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Submit Correction
            </button>
          </div>
        </form>
      </ModalDialog>
    </AppShell>
  );
}


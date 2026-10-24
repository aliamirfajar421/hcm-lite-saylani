"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import {
  aiSmartLeaveApi,
  applyLeaveApi,
  cancelLeaveApi,
  getMyLeaveBalancesApi,
  LeaveBalanceItem,
  listLeavesApi,
  reviewLeaveApi,
} from "@/api/hcm";
import { getApiErrorMessage } from "@/lib/api";
import { StatusPill } from "@/components/Charts";
import AiBadge from "@/components/AiBadge";
import ModalDialog from "@/components/ModalDialog";

export default function LeavesPage() {
  const { user } = useAuth();
  const canApply = user?.role === "hr" || user?.role === "employee";
  const isHr = user?.role === "hr";

  const [balances, setBalances] = useState<LeaveBalanceItem[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [leaves, setLeaves] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");

  // Smart Leave state (#21)
  const [smartPrompt, setSmartPrompt] = useState("");
  const [smartLoading, setSmartLoading] = useState(false);
  const [aiPrefilledNote, setAiPrefilledNote] = useState("");

  // Normal Leave Form state (#12)
  const [leaveTypeCode, setLeaveTypeCode] = useState("casual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [leaveSource, setLeaveSource] = useState<"manual" | "smart_ai">("manual");
  const [submitting, setSubmitting] = useState(false);

  // HR Review Modal (#13)
  const [reviewTarget, setReviewTarget] = useState<{
    id: string;
    decision: "approved" | "rejected";
    empName: string;
  } | null>(null);
  const [reviewComment, setReviewComment] = useState("");

  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [bal, list] = await Promise.all([
        canApply ? getMyLeaveBalancesApi() : Promise.resolve([]),
        listLeavesApi(statusFilter ? { status: statusFilter } : undefined),
      ]);
      setBalances(bal);
      setLeaves(list);
      if (bal.length > 0 && !bal.some((b) => b.code === leaveTypeCode)) {
        setLeaveTypeCode(bal[0].code);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [canApply, statusFilter, leaveTypeCode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSmartLeaveParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smartPrompt.trim()) return;
    setSmartLoading(true);
    setError("");
    setAiPrefilledNote("");
    try {
      const res = await aiSmartLeaveApi(smartPrompt.trim());
      const s = res.suggestion;
      setLeaveTypeCode(s.type);
      setStartDate(s.start);
      setEndDate(s.end);
      setReason(s.reason);
      setLeaveSource("smart_ai");
      setAiPrefilledNote(
        `Pre-filled ${s.leaveTypeName} (${s.start} → ${s.end}, ${s.workingDays} working day(s)). Please review below and click Confirm & Submit.`
      );
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Could not parse smart leave sentence — please fill the form below.")
      );
    } finally {
      setSmartLoading(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setToast("");
    try {
      const res = await applyLeaveApi({
        leaveTypeCode,
        startDate,
        endDate,
        reason,
        source: leaveSource,
      });
      setToast(res.message);
      setReason("");
      setSmartPrompt("");
      setAiPrefilledNote("");
      setLeaveSource("manual");
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Leave Management & Smart Leave</h1>
          <p className="text-xs text-muted">
            Working days calculation skips weekends & public holidays · Overlap & over-balance
            checks (HTTP 422) · HR approval inbox.
          </p>
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

        {/* Yearly Quota Balances + Smart Leave + Normal Form (Employee & HR) */}
        {canApply && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {balances.map((b) => (
                <div key={b.leaveTypeId} className="surface-card rounded-xl p-4">
                  <p className="text-xs font-semibold text-muted">{b.name}</p>
                  <p className="mt-1 text-2xl font-bold">
                    {b.isUnlimited ? "∞" : `${b.remaining}`}
                    {!b.isUnlimited && (
                      <span className="text-xs font-normal text-muted"> / {b.quota} days</span>
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Approved: {b.approvedDays}d · Pending: {b.pendingDays}d
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* M8 #21: Smart Leave Natural Language Assistant */}
              <form
                onSubmit={handleSmartLeaveParse}
                className="surface-card rounded-2xl border-l-4 border-l-teal-500 p-5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold">✦ AI Smart Leave Assistant</h2>
                  <AiBadge />
                </div>
                <p className="text-xs text-muted">
                  Type your leave request in plain English or Roman Urdu. AI validates & pre-fills
                  the leave form on the right — it never saves without your confirmation.
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    "I need next Monday and Tuesday off for my sister's wedding",
                    "Need tomorrow off due to fever and doctor visit",
                    "Mujhe kal aur parso bukhar ki wajah se chutti chahiye",
                  ].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => setSmartPrompt(sample)}
                      className="rounded-full surface-subtle px-2.5 py-1 text-[11px] hover:border-teal-500"
                    >
                      {sample}
                    </button>
                  ))}
                </div>

                <label htmlFor="smart-leave-input" className="visually-hidden">
                  Describe your leave in plain words
                </label>
                <textarea
                  id="smart-leave-input"
                  rows={2}
                  value={smartPrompt}
                  onChange={(e) => setSmartPrompt(e.target.value)}
                  placeholder='e.g. "Need next Monday and Tuesday off for a wedding"'
                  className="input-field"
                />

                <button
                  type="submit"
                  disabled={smartLoading || !smartPrompt.trim()}
                  className="btn-primary text-xs"
                >
                  {smartLoading ? "Parsing dates & leave type..." : "✦ Pre-Fill Leave Form →"}
                </button>
              </form>

              {/* M5 #12: Standard Leave Form (Confirm Pre-Filled or Manual) */}
              <form onSubmit={handleApplyLeave} className="surface-card rounded-2xl p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">Apply for Leave</h2>
                  {aiPrefilledNote && <AiBadge />}
                </div>

                {aiPrefilledNote && (
                  <div className="rounded-lg bg-teal-500/15 p-2.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                    {aiPrefilledNote}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="lv-type" className="block text-xs font-semibold mb-1">
                      Leave Type *
                    </label>
                    <select
                      id="lv-type"
                      required
                      value={leaveTypeCode}
                      onChange={(e) => setLeaveTypeCode(e.target.value)}
                      className="input-field"
                    >
                      {balances.length > 0 ? (
                        balances.map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="casual">Casual Leave</option>
                          <option value="sick">Sick Leave</option>
                          <option value="annual">Annual Leave</option>
                          <option value="unpaid">Unpaid Leave</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="lv-start" className="block text-xs font-semibold mb-1">
                      Start Date *
                    </label>
                    <input
                      id="lv-start"
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="lv-end" className="block text-xs font-semibold mb-1">
                      End Date *
                    </label>
                    <input
                      id="lv-end"
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="lv-reason" className="block text-xs font-semibold mb-1">
                    Reason *
                  </label>
                  <input
                    id="lv-reason"
                    required
                    placeholder="Reason for leave"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting || balances.length === 0}
                    className="btn-primary"
                  >
                    {submitting ? "Submitting..." : "Confirm & Submit Leave Request"}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* Leave History & HR Approval Inbox (#12 & #13) */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">
              {user?.role === "employee" ? "My Leave History" : "Leave Requests & Approval Inbox"}
            </h2>
            {user?.role !== "employee" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter leave status"
                className="input-field max-w-44"
              >
                <option value="">All Requests</option>
                <option value="pending">Pending Only</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            )}
          </div>

          <div className="table-wrapper">
            <table
              className="stack-table"
              style={
                {
                  "--label-2": '"Leave Type"',
                  "--label-3": '"Dates & Days"',
                  "--label-4": '"Reason"',
                  "--label-5": '"Status"',
                  "--label-6": '"Action"',
                } as React.CSSProperties
              }
            >
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Dates & Working Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted">
                      No leave requests found.
                    </td>
                  </tr>
                ) : (
                  leaves.map((lv) => {
                    const isOwn = String(lv.userId?._id || lv.userId) === user?.id;
                    const empLabel =
                      lv.employeeId?.fullName || lv.userId?.name || "Employee";
                    return (
                      <tr key={lv._id}>
                        <th>
                          <div>
                            <p>{empLabel}</p>
                            {lv.source === "smart_ai" && (
                              <span className="text-[10px] font-semibold text-teal-600">
                                ✦ Smart Leave
                              </span>
                            )}
                          </div>
                        </th>
                        <td>{lv.leaveTypeName}</td>
                        <td className="font-mono text-xs">
                          {lv.startDate} → {lv.endDate} ({lv.workingDays}d)
                        </td>
                        <td>
                          <p>{lv.reason}</p>
                          {lv.reviewComment && (
                            <p className="text-xs text-muted">HR Note: {lv.reviewComment}</p>
                          )}
                        </td>
                        <td>
                          <StatusPill status={lv.status} />
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            {isOwn && lv.status === "pending" && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await cancelLeaveApi(lv._id);
                                  setToast("Leave request cancelled");
                                  void loadData();
                                }}
                                className="btn-secondary py-1 px-2.5 text-xs"
                              >
                                Cancel
                              </button>
                            )}
                            {isHr && !isOwn && lv.status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewComment("Approved as per quota");
                                    setReviewTarget({
                                      id: lv._id,
                                      decision: "approved",
                                      empName: empLabel,
                                    });
                                  }}
                                  className="btn-primary py-1 px-2.5 text-xs"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewComment("");
                                    setReviewTarget({
                                      id: lv._id,
                                      decision: "rejected",
                                      empName: empLabel,
                                    });
                                  }}
                                  className="btn-secondary py-1 px-2.5 text-xs text-rose-600"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* HR Review Leave Modal with Comment (#13) */}
      <ModalDialog
        open={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title={
          reviewTarget
            ? `${reviewTarget.decision === "approved" ? "Approve" : "Reject"} Leave Request`
            : "Review Leave"
        }
        subtitle={reviewTarget ? `Employee: ${reviewTarget.empName}` : ""}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!reviewTarget) return;
            try {
              const res = await reviewLeaveApi(reviewTarget.id, {
                decision: reviewTarget.decision,
                comment: reviewComment,
              });
              setToast(res.message);
              setReviewTarget(null);
              void loadData();
            } catch (err) {
              setError(getApiErrorMessage(err));
            }
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="rv-comment" className="block text-xs font-semibold mb-1">
              HR Review Comment
            </label>
            <textarea
              id="rv-comment"
              rows={3}
              placeholder="Add an optional note for the employee..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setReviewTarget(null)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary capitalize">
              Confirm {reviewTarget?.decision}
            </button>
          </div>
        </form>
      </ModalDialog>
    </AppShell>
  );
}


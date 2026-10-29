"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  addGoalApi,
  downloadExperiencePdf,
  downloadOfferLetterPdf,
  generateAiPerformanceReviewApi,
  listPerformanceApi,
  OkrGoal,
  PerformanceRecord,
  submitAppraisalApi,
  updateGoalProgressApi,
} from "@/api/hcm";
import { getApiErrorMessage } from "@/lib/api";
import { triggerConfetti } from "@/lib/confetti";
import { sound } from "@/lib/audio";
import AiBadge from "@/components/AiBadge";

export default function PerformancePage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<PerformanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  // Goal Form
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalMetric, setNewGoalMetric] = useState("");
  const [newGoalProgress, setNewGoalProgress] = useState(25);
  const [addingGoal, setAddingGoal] = useState(false);

  // Appraisal Form (Admin / HR)
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listPerformanceApi();
      setRecords(res.records || []);
      if (res.myRecord) {
        setSelectedRecord(res.myRecord);
      } else if (res.records?.length > 0) {
        setSelectedRecord(res.records[0]);
        setRating(res.records[0].managerRating || 5);
        setFeedback(res.records[0].managerFeedback || "");
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load performance records"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    setAddingGoal(true);
    setError("");
    try {
      await addGoalApi({
        title: newGoalTitle,
        targetMetric: newGoalMetric,
        progress: Number(newGoalProgress),
        employeeId: selectedRecord?.employeeId?._id,
      });
      sound.playSuccess();
      setToast("OKR Goal added successfully!");
      setNewGoalTitle("");
      setNewGoalMetric("");
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setAddingGoal(false);
    }
  };

  const handleProgressChange = async (recordId: string, goalId: string, newProgress: number) => {
    try {
      const status = newProgress >= 100 ? "completed" : "in_progress";
      await updateGoalProgressApi(recordId, goalId, { progress: newProgress, status });
      if (newProgress >= 100) {
        triggerConfetti(2000);
      } else {
        sound.playClick();
      }
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleSubmitAppraisal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSubmittingReview(true);
    setError("");
    try {
      await submitAppraisalApi(selectedRecord._id, { rating, feedback });
      triggerConfetti(2500);
      setToast("Performance appraisal saved & published!");
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleGenerateAi = async () => {
    if (!selectedRecord) return;
    setGeneratingAi(true);
    setError("");
    try {
      const res = await generateAiPerformanceReviewApi(selectedRecord._id);
      triggerConfetti(2500);
      setToast(res.message);
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setGeneratingAi(false);
    }
  };

  return (
    <AppShell allowedRoles={["admin", "hr", "employee"]}>
      <div className="space-y-6">
        {/* VIP Header Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-950/80 via-slate-950/90 to-purple-950/70 p-6 shadow-2xl backdrop-blur-xl">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/20 px-3 py-1 text-xs font-black uppercase text-amber-300">
                  <span>🎯</span> OKRs & Performance Management
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                  Q4 2026 Cycle
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Workforce Goals & Appraisals
              </h1>
              <p className="text-xs sm:text-sm text-amber-200/80 max-w-xl">
                Track strategic quarterly targets, conduct 360° manager performance reviews, and generate AI synthesis reports.
              </p>
            </div>

            {selectedRecord && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void downloadOfferLetterPdf(
                      selectedRecord.employeeId?._id,
                      selectedRecord.employeeId?.employeeCode
                    )
                  }
                  className="rounded-xl border border-teal-500/30 bg-teal-500/20 px-3 py-2 text-xs font-bold text-teal-300 hover:bg-teal-500/30 transition shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  <span>Offer Letter PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void downloadExperiencePdf(
                      selectedRecord.employeeId?._id,
                      selectedRecord.employeeId?.employeeCode
                    )
                  }
                  className="rounded-xl border border-purple-500/30 bg-purple-500/20 px-3 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500/30 transition shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  <span>Experience Certificate</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status Alerts */}
        {toast && (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <span>{toast}</span>
            <button type="button" onClick={() => setToast("")} className="text-xs hover:underline">Dismiss</button>
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 p-3.5 text-sm font-medium text-rose-700 dark:text-rose-300 flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="text-xs hover:underline">Dismiss</button>
          </div>
        )}

        {/* Member Selector for Admin & HR */}
        {user?.role !== "employee" && records.length > 1 && (
          <div className="surface-card rounded-2xl p-4 flex items-center gap-3 overflow-x-auto">
            <span className="text-xs font-bold text-muted uppercase shrink-0">Select Employee:</span>
            {records.map((r) => (
              <button
                key={r._id}
                type="button"
                onClick={() => {
                  setSelectedRecord(r);
                  setRating(r.managerRating || 5);
                  setFeedback(r.managerFeedback || "");
                }}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
                  selectedRecord?._id === r._id
                    ? "bg-amber-600 text-white shadow-md shadow-amber-900/30"
                    : "surface-subtle text-muted hover:text-foreground border border-default"
                }`}
              >
                {r.employeeId?.fullName || r.userId?.name || "Employee"} ({r.employeeId?.employeeCode || "EMP"})
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="surface-card h-64 animate-pulse rounded-2xl p-6" />
        ) : !selectedRecord ? (
          <div className="surface-card rounded-2xl p-12 text-center text-muted">
            <p className="text-base font-bold">No performance records found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: OKR Goals Tracker */}
            <div className="lg:col-span-2 space-y-6">
              <div className="surface-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold">
                      Quarterly OKR Goals ({selectedRecord.goals?.length || 0})
                    </h2>
                    <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-xs font-bold text-teal-600 dark:text-teal-400">
                      {selectedRecord.period}
                    </span>
                  </div>
                  <span className="text-xs text-muted">
                    Employee: <strong>{selectedRecord.employeeId?.fullName || selectedRecord.userId?.name}</strong>
                  </span>
                </div>

                {/* Goals List */}
                <div className="space-y-3">
                  {(selectedRecord.goals || []).map((goal: OkrGoal) => (
                    <div
                      key={goal._id}
                      className="surface-subtle rounded-xl p-4 border border-default/50 space-y-3 hover:border-amber-500/40 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold text-foreground">{goal.title}</h3>
                          {goal.description && <p className="text-xs text-muted">{goal.description}</p>}
                          {goal.targetMetric && (
                            <p className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                              Target: {goal.targetMetric}
                            </p>
                          )}
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                            goal.status === "completed"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : goal.status === "delayed"
                              ? "bg-rose-500/20 text-rose-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {goal.status.replace("_", " ")}
                        </span>
                      </div>

                      {/* Progress Bar & Interactive Quick Steppers */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-muted">Milestone Completion</span>
                          <span className="font-bold text-foreground">{goal.progress}%</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              goal.progress >= 100
                                ? "bg-emerald-500"
                                : "bg-gradient-to-r from-amber-500 to-orange-500"
                            }`}
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>

                        {/* Quick Progress Buttons */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[11px] text-muted mr-1">Update Progress:</span>
                          {[25, 50, 75, 100].map((step) => (
                            <button
                              key={step}
                              type="button"
                              onClick={() => handleProgressChange(selectedRecord._id, goal._id, step)}
                              className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition ${
                                goal.progress === step
                                  ? "bg-amber-600 text-white"
                                  : "surface-card border border-default hover:border-amber-400/50 text-muted"
                              }`}
                            >
                              {step}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add New OKR Goal */}
                <form onSubmit={handleAddGoal} className="border-t border-default/50 pt-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                    + Add New Strategic OKR Goal
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="e.g. Optimize React Rendering & Reduce Bundle"
                      value={newGoalTitle}
                      onChange={(e) => setNewGoalTitle(e.target.value)}
                      className="input-field text-xs"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Metric: e.g. <100ms LCP on 4G"
                      value={newGoalMetric}
                      onChange={(e) => setNewGoalMetric(e.target.value)}
                      className="input-field text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted">Initial Progress:</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={newGoalProgress}
                        onChange={(e) => setNewGoalProgress(Number(e.target.value))}
                        className="w-28 accent-amber-500"
                      />
                      <span className="font-bold">{newGoalProgress}%</span>
                    </div>
                    <button
                      type="submit"
                      disabled={addingGoal}
                      className="btn-primary py-1.5 px-4 text-xs font-bold"
                    >
                      {addingGoal ? "Adding..." : "+ Create Goal"}
                    </button>
                  </div>
                </form>
              </div>

              {/* AI Performance Synthesis Card */}
              <div className="surface-card rounded-2xl p-5 space-y-3 border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold">Gemini AI Performance Synthesis</h2>
                    <AiBadge />
                  </div>
                  <button
                    type="button"
                    disabled={generatingAi}
                    onClick={handleGenerateAi}
                    className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span>✦</span>
                    <span>{generatingAi ? "Generating..." : "Generate AI Appraisal"}</span>
                  </button>
                </div>
                {selectedRecord.aiSummary ? (
                  <div className="surface-subtle rounded-xl p-4 text-xs space-y-1.5 whitespace-pre-line font-mono text-foreground border border-default">
                    {selectedRecord.aiSummary}
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Click &quot;Generate AI Appraisal&quot; to synthesize attendance punctuality streak, completed OKRs, and manager feedback.
                  </p>
                )}
              </div>
            </div>

            {/* Right Col: 360° Manager Appraisal & Rating */}
            <div className="space-y-6">
              <div className="surface-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">360° Manager Appraisal</h2>
                  <span className="text-xs text-amber-500 font-bold">
                    {"★".repeat(selectedRecord.managerRating || 5)}{" "}
                    <span className="text-muted font-normal">({selectedRecord.managerRating || 5}/5)</span>
                  </span>
                </div>

                {user?.role === "employee" ? (
                  <div className="space-y-3 text-xs">
                    <div className="surface-subtle rounded-xl p-3 space-y-1">
                      <span className="text-[11px] font-bold text-muted">Manager Feedback:</span>
                      <p className="italic text-foreground">
                        &quot;{selectedRecord.managerFeedback || "Exemplary performance across all quarterly deliverables. Keep up the high standard!"}&quot;
                      </p>
                    </div>
                    {selectedRecord.reviewedAt && (
                      <p className="text-[10px] text-muted">
                        Reviewed on {new Date(selectedRecord.reviewedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSubmitAppraisal} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold mb-1">Score Rating (1 to 5 Stars):</label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            className={`text-2xl transition ${
                              star <= rating ? "text-amber-400 scale-110" : "text-slate-300 dark:text-slate-700"
                            }`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">Formal Review & Feedback Notes:</label>
                      <textarea
                        rows={4}
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Provide detailed feedback on technical delivery, punctuality, and strategic leadership..."
                        className="input-field text-xs resize-none"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="btn-primary w-full py-2 text-xs font-bold"
                    >
                      {submittingReview ? "Saving..." : "Publish Manager Appraisal"}
                    </button>
                  </form>
                )}
              </div>

              {/* Quick Actions & Official Letters */}
              <div className="surface-card rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-bold">Official HR Letters</h2>
                <p className="text-xs text-muted">
                  Generate signed corporate letters with Saylani Tech letterhead and electronic seal:
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() =>
                      void downloadOfferLetterPdf(
                        selectedRecord.employeeId?._id,
                        selectedRecord.employeeId?.employeeCode
                      )
                    }
                    className="btn-secondary w-full py-2 text-xs font-bold justify-start gap-2"
                  >
                    <span>📄</span>
                    <span>Download Offer Letter PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void downloadExperiencePdf(
                        selectedRecord.employeeId?._id,
                        selectedRecord.employeeId?.employeeCode
                      )
                    }
                    className="btn-secondary w-full py-2 text-xs font-bold justify-start gap-2"
                  >
                    <span>🎖️</span>
                    <span>Download Experience Certificate PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

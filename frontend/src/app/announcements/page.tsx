"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import {
  createAnnouncementApi,
  Department,
  listAnnouncementsApi,
  listDepartmentsApi,
} from "@/api/hcm";
import { getApiErrorMessage } from "@/lib/api";
import { StatusPill } from "@/components/Charts";

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const canPost = user?.role === "admin" || user?.role === "hr";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [departmentId, setDepartmentId] = useState("");

  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const anns = await listAnnouncementsApi();
      setAnnouncements(anns);
      if (canPost) {
        const depts = await listDepartmentsApi();
        setDepartments(depts);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [canPost]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Company Announcements</h1>
          <p className="text-xs text-muted">
            {canPost
              ? "Publish company-wide or department-specific notices with automatic in-app notifications."
              : "Official notices and updates from Admin & HR."}
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

        {canPost && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              try {
                const res = await createAnnouncementApi({
                  title,
                  body,
                  priority,
                  departmentId: departmentId || null,
                });
                setToast(res.message);
                setTitle("");
                setBody("");
                void loadAll();
              } catch (err) {
                setError(getApiErrorMessage(err));
              }
            }}
            className="surface-card rounded-2xl p-5 space-y-4"
          >
            <h2 className="text-sm font-bold">Publish New Announcement</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="ann-title" className="block text-xs font-semibold mb-1">
                  Title *
                </label>
                <input
                  id="ann-title"
                  required
                  placeholder="Monthly Townhall / Policy Update"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="ann-prio" className="block text-xs font-semibold mb-1">
                  Priority
                </label>
                <select
                  id="ann-prio"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="input-field"
                >
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label htmlFor="ann-dept" className="block text-xs font-semibold mb-1">
                  Target Audience
                </label>
                <select
                  id="ann-dept"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="input-field"
                >
                  <option value="">All Employees (Company-Wide)</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} Department Only
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="ann-body" className="block text-xs font-semibold mb-1">
                Message *
              </label>
              <textarea
                id="ann-body"
                rows={3}
                required
                placeholder="Write announcement details..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn-primary">
                📢 Publish & Notify Team
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="surface-card rounded-2xl p-8 text-center text-sm text-muted">
              No announcements have been published yet.
            </div>
          ) : (
            announcements.map((a) => (
              <article key={a._id} className="surface-card rounded-2xl p-5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold">{a.title}</h2>
                  <div className="flex items-center gap-2">
                    {a.departmentId?.name && (
                      <span className="rounded-full surface-subtle px-2.5 py-0.5 text-xs">
                        {a.departmentId.name}
                      </span>
                    )}
                    <StatusPill status={a.priority} />
                  </div>
                </div>
                <p className="text-sm whitespace-pre-line">{a.body}</p>
                <p className="text-xs text-muted">
                  Posted by {a.authorName} ({a.authorRole.toUpperCase()}) ·{" "}
                  {new Date(a.createdAt).toLocaleString()}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}


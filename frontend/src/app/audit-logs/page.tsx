"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { listAuditLogsApi } from "@/api/hcm";
import { getApiErrorMessage } from "@/lib/api";
import ModalDialog from "@/components/ModalDialog";

export default function AuditLogsPage() {
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [logs, setLogs] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [error, setError] = useState("");

  const loadLogs = useCallback(async () => {
    setError("");
    try {
      const res = await listAuditLogsApi({
        entityType: entityType || undefined,
        page,
      });
      setLogs(res.logs);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [entityType, page]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <AppShell allowedRoles={["admin"]}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Immutable Audit Log ({total})</h1>
            <p className="text-xs text-muted">
              Admin-only tamper-proof record of every create, update, approval, password reset, and
              payroll finalization with Before/After JSON snapshots.
            </p>
          </div>

          <select
            value={entityType}
            onChange={(e) => {
              setPage(1);
              setEntityType(e.target.value);
            }}
            aria-label="Filter by entity type"
            className="input-field max-w-56"
          >
            <option value="">All Entities</option>
            <option value="CompanySettings">CompanySettings</option>
            <option value="Department">Department</option>
            <option value="LeaveType">LeaveType</option>
            <option value="User">User</option>
            <option value="Employee">Employee</option>
            <option value="LeaveRequest">LeaveRequest</option>
            <option value="AttendanceCorrection">AttendanceCorrection</option>
            <option value="PayrollRun">PayrollRun</option>
            <option value="Announcement">Announcement</option>
          </select>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-500/15 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="table-wrapper">
          <table
            className="stack-table"
            style={
              {
                "--label-2": '"Actor"',
                "--label-3": '"Entity"',
                "--label-4": '"Summary"',
                "--label-5": '"Timestamp"',
                "--label-6": '"JSON"',
              } as React.CSSProperties
            }
          >
            <thead>
              <tr>
                <th>Action</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Summary</th>
                <th>Timestamp</th>
                <th>Before / After</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No audit entries found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id}>
                    <th className="font-mono text-xs">{log.action}</th>
                    <td className="text-xs">
                      <p className="font-semibold">{log.actorName}</p>
                      <p className="text-muted uppercase text-[10px]">{log.actorRole}</p>
                    </td>
                    <td className="font-mono text-xs">{log.entityType}</td>
                    <td>{log.summary}</td>
                    <td className="font-mono text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="btn-secondary py-1 px-2.5 text-xs"
                      >
                        Inspect JSON
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex justify-end gap-2 text-xs">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn-secondary py-1 px-3"
            >
              Previous
            </button>
            <span className="self-center text-muted">
              Page {page} / {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary py-1 px-3"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <ModalDialog
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? `Audit Entry: ${selectedLog.action}` : "Audit JSON"}
        subtitle={selectedLog ? selectedLog.summary : ""}
        maxWidthClass="max-w-2xl"
      >
        {selectedLog && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div>
              <p className="font-bold mb-1.5 text-muted">Before Snapshot</p>
              <pre className="surface-subtle rounded-xl p-3 overflow-x-auto font-mono text-[11px]">
                {JSON.stringify(selectedLog.before ?? null, null, 2)}
              </pre>
            </div>
            <div>
              <p className="font-bold mb-1.5 text-muted">After Snapshot</p>
              <pre className="surface-subtle rounded-xl p-3 overflow-x-auto font-mono text-[11px]">
                {JSON.stringify(selectedLog.after ?? null, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </ModalDialog>
    </AppShell>
  );
}


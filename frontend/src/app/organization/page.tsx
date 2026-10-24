"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import {
  CompanySettings,
  createDepartmentApi,
  createDesignationApi,
  createHolidayApi,
  createHrLoginApi,
  createLeaveTypeApi,
  deleteDepartmentApi,
  deleteDesignationApi,
  deleteHolidayApi,
  Department,
  Designation,
  getCompanySettingsApi,
  Holiday,
  LeaveType,
  listDepartmentsApi,
  listDesignationsApi,
  listHolidaysApi,
  listLeaveTypesApi,
  listUsersApi,
  resetUserPasswordApi,
  toggleUserStatusApi,
  updateCompanySettingsApi,
} from "@/api/hcm";
import { getApiErrorMessage } from "@/lib/api";
import { StatusPill } from "@/components/Charts";
import ModalDialog from "@/components/ModalDialog";

const WEEK_DAYS = [
  { day: 0, label: "Sun" },
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
];

export default function OrganizationPage() {
  const { user, refreshMe } = useAuth();
  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState<
    "settings" | "departments" | "designations" | "leaves" | "holidays" | "users"
  >("settings");

  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [users, setUsers] = useState<any[]>([]);

  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  // Forms
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [desigTitle, setDesigTitle] = useState("");
  const [desigDeptId, setDesigDeptId] = useState("");
  const [desigLevel, setDesigLevel] = useState("Mid");

  const [ltName, setLtName] = useState("");
  const [ltCode, setLtCode] = useState("");
  const [ltQuota, setLtQuota] = useState("10");
  const [ltPaid, setLtPaid] = useState(true);
  const [ltUnlimited, setLtUnlimited] = useState(false);

  const [holName, setHolName] = useState("");
  const [holDate, setHolDate] = useState("");

  // Admin HR login creation & Password Reset
  const [hrName, setHrName] = useState("");
  const [hrEmail, setHrEmail] = useState("");
  const [hrTempPass, setHrTempPass] = useState("HrTemp@123");
  const [createdCreds, setCreatedCreds] = useState<{ email: string; pass: string } | null>(null);

  const [resetTarget, setResetTarget] = useState<{ id: string; email: string } | null>(null);
  const [resetTempPass, setResetTempPass] = useState("Reset@123");

  const loadAll = useCallback(async () => {
    setError("");
    try {
      const [s, d, ds, lt, h] = await Promise.all([
        getCompanySettingsApi(),
        listDepartmentsApi(),
        listDesignationsApi(),
        listLeaveTypesApi(),
        listHolidaysApi(),
      ]);
      setSettings(s);
      setDepartments(d);
      setDesignations(ds);
      setLeaveTypes(lt);
      setHolidays(h);

      if (isAdmin) {
        const u = await listUsersApi();
        setUsers(u);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !isAdmin) return;
    setError("");
    setToast("");
    try {
      const res = await updateCompanySettingsApi(settings);
      setSettings(res.settings);
      setToast(res.message);
      void refreshMe();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleUseBrowserGps = () => {
    if (!settings || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSettings({
          ...settings,
          officeLocation: {
            ...settings.officeLocation,
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
          },
        });
        setToast(`Updated coordinates from browser GPS (±${Math.round(pos.coords.accuracy)}m) — click Save Settings to apply.`);
      },
      () => setError("Unable to read browser GPS location."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSeedStandardLeaves = async () => {
    setError("");
    try {
      const defaults = [
        { name: "Annual Leave", code: "annual", yearlyQuota: 14, isPaid: true, isUnlimited: false },
        { name: "Sick Leave", code: "sick", yearlyQuota: 8, isPaid: true, isUnlimited: false },
        { name: "Casual Leave", code: "casual", yearlyQuota: 10, isPaid: true, isUnlimited: false },
        { name: "Unpaid Leave", code: "unpaid", yearlyQuota: 0, isPaid: false, isUnlimited: true },
      ];
      for (const item of defaults) {
        await createLeaveTypeApi(item).catch(() => null);
      }
      setToast("Standard leave types & quotas loaded.");
      void loadAll();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <AppShell allowedRoles={["admin", "hr"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Organization Setup & Access</h1>
          <p className="text-xs text-muted">
            {isAdmin
              ? "Manage company rules, geofence coordinates, departments, leave quotas, holidays, and HR/Employee logins."
              : "Read-only view of company settings, departments, designations, leave quotas, and holidays."}
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[var(--border-color)] pb-3">
          {[
            { id: "settings", label: "Company Rules & Geofence" },
            { id: "departments", label: `Departments (${departments.length})` },
            { id: "designations", label: `Designations (${designations.length})` },
            { id: "leaves", label: `Leave Quotas (${leaveTypes.length})` },
            { id: "holidays", label: `Public Holidays (${holidays.length})` },
            ...(isAdmin ? [{ id: "users", label: `User Logins (${users.length})` }] : []),
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={tab === t.id ? "btn-primary text-xs" : "btn-secondary text-xs"}
            >
              {t.label}
            </button>
          ))}
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

        {/* TAB 1: COMPANY SETTINGS & GEOFENCE */}
        {tab === "settings" && settings && (
          <form onSubmit={handleSaveSettings} className="surface-card rounded-2xl p-6 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="org-name" className="block text-xs font-semibold mb-1">
                  Company Name
                </label>
                <input
                  id="org-name"
                  disabled={!isAdmin}
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="org-curr" className="block text-xs font-semibold mb-1">
                  Currency
                </label>
                <input
                  id="org-curr"
                  disabled={!isAdmin}
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="org-tz" className="block text-xs font-semibold mb-1">
                  Timezone
                </label>
                <input
                  id="org-tz"
                  disabled={!isAdmin}
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="org-start" className="block text-xs font-semibold mb-1">
                  Office Start Time
                </label>
                <input
                  id="org-start"
                  type="time"
                  disabled={!isAdmin}
                  value={settings.officeStartTime}
                  onChange={(e) => setSettings({ ...settings, officeStartTime: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="org-grace" className="block text-xs font-semibold mb-1">
                  Grace Period (Minutes)
                </label>
                <input
                  id="org-grace"
                  type="number"
                  disabled={!isAdmin}
                  value={settings.graceMinutes}
                  onChange={(e) =>
                    setSettings({ ...settings, graceMinutes: Number(e.target.value) })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="org-half" className="block text-xs font-semibold mb-1">
                  Half-Day Under (Hours)
                </label>
                <input
                  id="org-half"
                  type="number"
                  step="0.5"
                  disabled={!isAdmin}
                  value={settings.halfDayHours}
                  onChange={(e) =>
                    setSettings({ ...settings, halfDayHours: Number(e.target.value) })
                  }
                  className="input-field"
                />
              </div>
            </div>

            {/* Weekend Selector & Late Penalty Toggle */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-[var(--border-color)]">
              <div>
                <p className="text-xs font-semibold mb-2">Weekend Days (Skipped in Leave & Payroll)</p>
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map((w) => {
                    const checked = (settings.weekendDays || []).includes(w.day);
                    return (
                      <label
                        key={w.day}
                        className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                          checked
                            ? "border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300"
                            : "border-[var(--border-color)] text-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!isAdmin}
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? settings.weekendDays.filter((d) => d !== w.day)
                              : [...settings.weekendDays, w.day];
                            setSettings({ ...settings, weekendDays: next });
                          }}
                          className="mr-1.5"
                        />
                        {w.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={Boolean(settings.latePenaltyEnabled)}
                    onChange={(e) =>
                      setSettings({ ...settings, latePenaltyEnabled: e.target.checked })
                    }
                  />
                  <span>Enable Late Penalty Rule in Payroll (Every 3 lates = 0.5 day deduction)</span>
                </label>
              </div>
            </div>

            {/* Geofence Settings */}
            <div className="pt-3 border-t border-[var(--border-color)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold">
                  Office Geofence Coordinates (Camera Attendance)
                </h2>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleUseBrowserGps}
                    className="btn-secondary text-xs py-1 px-2.5"
                  >
                    📍 Set to My Current GPS Location
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label htmlFor="geo-lat" className="block text-xs font-semibold mb-1">
                    Office Latitude
                  </label>
                  <input
                    id="geo-lat"
                    type="number"
                    step="any"
                    disabled={!isAdmin}
                    value={settings.officeLocation?.lat ?? 24.8607}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        officeLocation: {
                          ...settings.officeLocation,
                          lat: Number(e.target.value),
                        },
                      })
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="geo-lng" className="block text-xs font-semibold mb-1">
                    Office Longitude
                  </label>
                  <input
                    id="geo-lng"
                    type="number"
                    step="any"
                    disabled={!isAdmin}
                    value={settings.officeLocation?.lng ?? 67.0011}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        officeLocation: {
                          ...settings.officeLocation,
                          lng: Number(e.target.value),
                        },
                      })
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="geo-rad" className="block text-xs font-semibold mb-1">
                    Radius (Meters)
                  </label>
                  <input
                    id="geo-rad"
                    type="number"
                    disabled={!isAdmin}
                    value={settings.officeLocation?.radiusMeters ?? 150}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        officeLocation: {
                          ...settings.officeLocation,
                          radiusMeters: Number(e.target.value),
                        },
                      })
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="geo-addr" className="block text-xs font-semibold mb-1">
                    Location Label
                  </label>
                  <input
                    id="geo-addr"
                    disabled={!isAdmin}
                    value={settings.officeLocation?.address ?? ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        officeLocation: {
                          ...settings.officeLocation,
                          address: e.target.value,
                        },
                      })
                    }
                    className="input-field"
                  />
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex justify-end">
                <button type="submit" className="btn-primary">
                  Save Company Settings
                </button>
              </div>
            )}
          </form>
        )}

        {/* TAB 2: DEPARTMENTS */}
        {tab === "departments" && (
          <div className="space-y-4">
            {isAdmin && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError("");
                  try {
                    await createDepartmentApi({ name: deptName, code: deptCode });
                    setDeptName("");
                    setDeptCode("");
                    setToast("Department created");
                    void loadAll();
                  } catch (err) {
                    setError(getApiErrorMessage(err));
                  }
                }}
                className="surface-card rounded-xl p-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                <div>
                  <label htmlFor="dept-name" className="block text-xs font-semibold mb-1">
                    Department Name *
                  </label>
                  <input
                    id="dept-name"
                    required
                    placeholder="e.g. Engineering"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="dept-code" className="block text-xs font-semibold mb-1">
                    Code *
                  </label>
                  <input
                    id="dept-code"
                    required
                    placeholder="e.g. ENG"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="btn-primary w-full">
                    + Add Department
                  </button>
                </div>
              </form>
            )}

            <div className="table-wrapper">
              <table
                className="stack-table"
                style={
                  {
                    "--label-2": '"Code"',
                    "--label-3": '"Action"',
                  } as React.CSSProperties
                }
              >
                <thead>
                  <tr>
                    <th>Department Name</th>
                    <th>Code</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center text-muted">
                        No departments added yet.
                      </td>
                    </tr>
                  ) : (
                    departments.map((d) => (
                      <tr key={d._id}>
                        <th>{d.name}</th>
                        <td className="font-mono">{d.code}</td>
                        <td>
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await deleteDepartmentApi(d._id);
                                  void loadAll();
                                } catch (err) {
                                  setError(getApiErrorMessage(err));
                                }
                              }}
                              className="text-xs font-semibold text-rose-600 hover:underline"
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="text-xs text-muted">View only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: DESIGNATIONS */}
        {tab === "designations" && (
          <div className="space-y-4">
            {isAdmin && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError("");
                  try {
                    await createDesignationApi({
                      title: desigTitle,
                      departmentId: desigDeptId || undefined,
                      level: desigLevel,
                    });
                    setDesigTitle("");
                    setToast("Designation created");
                    void loadAll();
                  } catch (err) {
                    setError(getApiErrorMessage(err));
                  }
                }}
                className="surface-card rounded-xl p-4 grid grid-cols-1 gap-3 sm:grid-cols-4"
              >
                <div>
                  <label htmlFor="des-title" className="block text-xs font-semibold mb-1">
                    Job Title *
                  </label>
                  <input
                    id="des-title"
                    required
                    placeholder="Software Engineer"
                    value={desigTitle}
                    onChange={(e) => setDesigTitle(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="des-dept" className="block text-xs font-semibold mb-1">
                    Department
                  </label>
                  <select
                    id="des-dept"
                    value={desigDeptId}
                    onChange={(e) => setDesigDeptId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Any Department</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="des-lvl" className="block text-xs font-semibold mb-1">
                    Level
                  </label>
                  <select
                    id="des-lvl"
                    value={desigLevel}
                    onChange={(e) => setDesigLevel(e.target.value)}
                    className="input-field"
                  >
                    {["Junior", "Mid", "Senior", "Lead", "Manager"].map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="submit" className="btn-primary w-full">
                    + Add Designation
                  </button>
                </div>
              </form>
            )}

            <div className="table-wrapper">
              <table
                className="stack-table"
                style={
                  {
                    "--label-2": '"Department"',
                    "--label-3": '"Level"',
                    "--label-4": '"Action"',
                  } as React.CSSProperties
                }
              >
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Department</th>
                    <th>Level</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {designations.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-muted">
                        No designations configured yet.
                      </td>
                    </tr>
                  ) : (
                    designations.map((ds) => (
                      <tr key={ds._id}>
                        <th>{ds.title}</th>
                        <td>{ds.departmentId?.name || "All"}</td>
                        <td>{ds.level}</td>
                        <td>
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteDesignationApi(ds._id);
                                void loadAll();
                              }}
                              className="text-xs font-semibold text-rose-600 hover:underline"
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="text-xs text-muted">View only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: LEAVE TYPES & QUOTAS */}
        {tab === "leaves" && (
          <div className="space-y-4">
            {isAdmin && (
              <div className="surface-card rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold">Configure Leave Type & Yearly Quota</p>
                  {leaveTypes.length === 0 && (
                    <button
                      type="button"
                      onClick={handleSeedStandardLeaves}
                      className="btn-secondary text-xs py-1 px-2.5"
                    >
                      ⚡ Load Standard Quotas (Annual 14, Sick 8, Casual 10, Unpaid)
                    </button>
                  )}
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setError("");
                    try {
                      await createLeaveTypeApi({
                        name: ltName,
                        code: ltCode,
                        yearlyQuota: Number(ltQuota),
                        isPaid: ltPaid,
                        isUnlimited: ltUnlimited,
                      });
                      setLtName("");
                      setLtCode("");
                      setToast("Leave type created");
                      void loadAll();
                    } catch (err) {
                      setError(getApiErrorMessage(err));
                    }
                  }}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-5"
                >
                  <input
                    required
                    placeholder="Name (e.g. Casual Leave)"
                    value={ltName}
                    onChange={(e) => setLtName(e.target.value)}
                    aria-label="Leave type name"
                    className="input-field"
                  />
                  <input
                    required
                    placeholder="Code (e.g. casual)"
                    value={ltCode}
                    onChange={(e) => setLtCode(e.target.value)}
                    aria-label="Leave type code"
                    className="input-field"
                  />
                  <input
                    type="number"
                    min={0}
                    disabled={ltUnlimited}
                    placeholder="Yearly Quota"
                    value={ltQuota}
                    onChange={(e) => setLtQuota(e.target.value)}
                    aria-label="Yearly quota"
                    className="input-field"
                  />
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={ltPaid}
                        onChange={(e) => setLtPaid(e.target.checked)}
                      />
                      Paid
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={ltUnlimited}
                        onChange={(e) => setLtUnlimited(e.target.checked)}
                      />
                      Unlimited
                    </label>
                  </div>
                  <button type="submit" className="btn-primary">
                    + Add Leave Type
                  </button>
                </form>
              </div>
            )}

            <div className="table-wrapper">
              <table
                className="stack-table"
                style={
                  {
                    "--label-2": '"Code"',
                    "--label-3": '"Yearly Quota"',
                    "--label-4": '"Pay Type"',
                  } as React.CSSProperties
                }
              >
                <thead>
                  <tr>
                    <th>Leave Type</th>
                    <th>Code</th>
                    <th>Yearly Quota</th>
                    <th>Pay Type</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveTypes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-muted">
                        No leave types created yet.
                      </td>
                    </tr>
                  ) : (
                    leaveTypes.map((lt) => (
                      <tr key={lt._id}>
                        <th>{lt.name}</th>
                        <td className="font-mono">{lt.code}</td>
                        <td>{lt.isUnlimited ? "Unlimited" : `${lt.yearlyQuota} days / year`}</td>
                        <td>{lt.isPaid ? "Paid Leave" : "Unpaid (Deducted)"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: PUBLIC HOLIDAYS */}
        {tab === "holidays" && (
          <div className="space-y-4">
            {isAdmin && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError("");
                  try {
                    await createHolidayApi({ name: holName, date: holDate });
                    setHolName("");
                    setHolDate("");
                    setToast("Holiday added");
                    void loadAll();
                  } catch (err) {
                    setError(getApiErrorMessage(err));
                  }
                }}
                className="surface-card rounded-xl p-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                <div>
                  <label htmlFor="hol-name" className="block text-xs font-semibold mb-1">
                    Holiday Title *
                  </label>
                  <input
                    id="hol-name"
                    required
                    placeholder="Iqbal Day / Eid Holiday"
                    value={holName}
                    onChange={(e) => setHolName(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="hol-date" className="block text-xs font-semibold mb-1">
                    Date *
                  </label>
                  <input
                    id="hol-date"
                    type="date"
                    required
                    value={holDate}
                    onChange={(e) => setHolDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="btn-primary w-full">
                    + Add Public Holiday
                  </button>
                </div>
              </form>
            )}

            <div className="table-wrapper">
              <table
                className="stack-table"
                style={
                  {
                    "--label-2": '"Date"',
                    "--label-3": '"Action"',
                  } as React.CSSProperties
                }
              >
                <thead>
                  <tr>
                    <th>Holiday</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center text-muted">
                        No public holidays added yet.
                      </td>
                    </tr>
                  ) : (
                    holidays.map((h) => (
                      <tr key={h._id}>
                        <th>{h.name}</th>
                        <td className="font-mono">{h.date}</td>
                        <td>
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteHolidayApi(h._id);
                                void loadAll();
                              }}
                              className="text-xs font-semibold text-rose-600 hover:underline"
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="text-xs text-muted">View only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: ADMIN USER & HR LOGIN MANAGEMENT (#05) */}
        {tab === "users" && isAdmin && (
          <div className="space-y-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                try {
                  const res = await createHrLoginApi({
                    name: hrName,
                    email: hrEmail,
                    temporaryPassword: hrTempPass,
                  });
                  setCreatedCreds({ email: res.user.email, pass: res.temporaryPassword });
                  setHrName("");
                  setHrEmail("");
                  setToast("HR login created! Share temporary credentials below.");
                  void loadAll();
                } catch (err) {
                  setError(getApiErrorMessage(err));
                }
              }}
              className="surface-card rounded-xl p-4 space-y-3"
            >
              <h2 className="text-sm font-bold">Create New HR Manager Login</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <input
                  required
                  placeholder="HR Full Name"
                  value={hrName}
                  onChange={(e) => setHrName(e.target.value)}
                  aria-label="HR Full Name"
                  className="input-field"
                />
                <input
                  type="email"
                  required
                  placeholder="hr@company.com"
                  value={hrEmail}
                  onChange={(e) => setHrEmail(e.target.value)}
                  aria-label="HR Email"
                  className="input-field"
                />
                <input
                  required
                  minLength={6}
                  placeholder="Temp Password"
                  value={hrTempPass}
                  onChange={(e) => setHrTempPass(e.target.value)}
                  aria-label="Temporary Password"
                  className="input-field"
                />
                <button type="submit" className="btn-primary">
                  + Create HR Login
                </button>
              </div>
              {createdCreds && (
                <div className="rounded-lg border border-teal-500/40 bg-teal-500/10 p-3 text-xs">
                  <strong>HR Credentials Created:</strong> Email:{" "}
                  <code className="font-mono font-bold">{createdCreds.email}</code> · Temporary
                  Password: <code className="font-mono font-bold">{createdCreds.pass}</code> (User
                  will be prompted to change password on first sign-in.)
                </div>
              )}
            </form>

            <div className="table-wrapper">
              <table
                className="stack-table"
                style={
                  {
                    "--label-2": '"Email"',
                    "--label-3": '"Role"',
                    "--label-4": '"Status"',
                    "--label-5": '"Actions"',
                  } as React.CSSProperties
                }
              >
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <th>{u.name}</th>
                      <td className="font-mono text-xs">{u.email}</td>
                      <td className="uppercase font-semibold text-xs">{u.role}</td>
                      <td>
                        <StatusPill status={u.isActive ? "active" : "exited"} />
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {u._id !== user?.id && (
                            <button
                              type="button"
                              onClick={async () => {
                                await toggleUserStatusApi(u._id, !u.isActive);
                                void loadAll();
                              }}
                              className="btn-secondary py-1 px-2 text-xs"
                            >
                              {u.isActive ? "Deactivate" : "Reactivate"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setResetTarget({ id: u._id, email: u.email })}
                            className="btn-secondary py-1 px-2 text-xs"
                          >
                            Reset Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Password Reset Modal */}
      <ModalDialog
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title="Reset Login Password"
        subtitle={resetTarget ? `Set a new temporary password for ${resetTarget.email}` : ""}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!resetTarget) return;
            try {
              const res = await resetUserPasswordApi(resetTarget.id, resetTempPass);
              setToast(`${res.message} (Temp Password: ${res.temporaryPassword})`);
              setResetTarget(null);
            } catch (err) {
              setError(getApiErrorMessage(err));
            }
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="rst-pass" className="block text-xs font-semibold mb-1">
              New Temporary Password (min 6 chars)
            </label>
            <input
              id="rst-pass"
              required
              minLength={6}
              value={resetTempPass}
              onChange={(e) => setResetTempPass(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setResetTarget(null)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Reset & Require Change on Login
            </button>
          </div>
        </form>
      </ModalDialog>
    </AppShell>
  );
}


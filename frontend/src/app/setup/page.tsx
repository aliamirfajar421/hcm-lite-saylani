"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { firstRunSetupApi } from "@/api/hcm";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

export default function FirstRunSetupPage() {
  const { initialized, loading, setSession } = useAuth();
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [officeStartTime, setOfficeStartTime] = useState("09:00");
  const [officeEndTime, setOfficeEndTime] = useState("18:00");
  const [graceMinutes, setGraceMinutes] = useState("15");
  const [halfDayHours, setHalfDayHours] = useState("5");
  const [officeAddress, setOfficeAddress] = useState("Zaitoon Ashraf IT Park, Karachi");
  const [officeLat, setOfficeLat] = useState("24.8607");
  const [officeLng, setOfficeLng] = useState("67.0011");
  const [radiusMeters, setRadiusMeters] = useState("150");

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [includeStandardLeaveQuotas, setIncludeStandardLeaveQuotas] = useState(true);
  const [starterDeptNames, setStarterDeptNames] = useState("Engineering, Human Resources, Finance");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [gpsStatus, setGpsStatus] = useState("");

  useEffect(() => {
    if (!loading && initialized === true) {
      router.replace("/login");
    }
  }, [loading, initialized, router]);

  const handleUseCurrentGps = () => {
    if (!("geolocation" in navigator)) {
      setGpsStatus("Geolocation not supported in this browser");
      return;
    }
    setGpsStatus("Reading current GPS coordinates...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficeLat(pos.coords.latitude.toFixed(6));
        setOfficeLng(pos.coords.longitude.toFixed(6));
        setGpsStatus(`Captured current location (±${Math.round(pos.coords.accuracy)}m)`);
      },
      () => {
        setGpsStatus("Could not read browser GPS — enter coordinates manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const initialDepartments = starterDeptNames
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name, idx) => ({
          name,
          code:
            name
              .replace(/[^a-zA-Z0-9]/g, "")
              .slice(0, 4)
              .toUpperCase() || `DPT${idx + 1}`,
        }));

      const initialLeaveTypes = includeStandardLeaveQuotas
        ? [
            { name: "Annual Leave", code: "annual", yearlyQuota: 14, isPaid: true, isUnlimited: false },
            { name: "Sick Leave", code: "sick", yearlyQuota: 8, isPaid: true, isUnlimited: false },
            { name: "Casual Leave", code: "casual", yearlyQuota: 10, isPaid: true, isUnlimited: false },
            { name: "Unpaid Leave", code: "unpaid", yearlyQuota: 0, isPaid: false, isUnlimited: true },
          ]
        : [];

      const res = await firstRunSetupApi({
        companyName,
        currency,
        officeStartTime,
        officeEndTime,
        graceMinutes: Number(graceMinutes),
        halfDayHours: Number(halfDayHours),
        weekendDays: [0, 6],
        officeLat: Number(officeLat),
        officeLng: Number(officeLng),
        officeAddress,
        radiusMeters: Number(radiusMeters),
        adminName,
        adminEmail,
        adminPassword,
        initialDepartments,
        initialLeaveTypes,
      });

      setSession(res);
      router.push("/organization");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to initialize company"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh py-8 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-lg font-bold text-white">
              H
            </span>
            <div>
              <h1 className="text-xl font-bold">HCM Lite · First-Run Setup</h1>
              <p className="text-xs text-muted">
                Fresh installation detected (0 dummy records). Set up your company & Admin account.
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <form onSubmit={handleSubmit} className="surface-card rounded-2xl p-6 shadow-sm space-y-6">
          {error && (
            <div className="rounded-xl bg-rose-500/15 p-3.5 text-sm font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Section 1: Company & Attendance Rules */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-teal-600 dark:text-teal-400">
              1. Company Profile & Attendance Rules
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="setup-company" className="block text-xs font-semibold mb-1">
                  Company Name *
                </label>
                <input
                  id="setup-company"
                  type="text"
                  required
                  placeholder="e.g. Saylani Tech Solutions"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="setup-currency" className="block text-xs font-semibold mb-1">
                  Payroll Currency
                </label>
                <input
                  id="setup-currency"
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="setup-start" className="block text-xs font-semibold mb-1">
                  Office Start Time (24h)
                </label>
                <input
                  id="setup-start"
                  type="time"
                  value={officeStartTime}
                  onChange={(e) => setOfficeStartTime(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="setup-end" className="block text-xs font-semibold mb-1">
                  Office End Time (24h)
                </label>
                <input
                  id="setup-end"
                  type="time"
                  value={officeEndTime}
                  onChange={(e) => setOfficeEndTime(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="setup-grace" className="block text-xs font-semibold mb-1">
                  Grace Period (Minutes)
                </label>
                <input
                  id="setup-grace"
                  type="number"
                  min={0}
                  max={120}
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="setup-half" className="block text-xs font-semibold mb-1">
                  Half-Day Threshold (Hours)
                </label>
                <input
                  id="setup-half"
                  type="number"
                  min={1}
                  max={10}
                  step="0.5"
                  value={halfDayHours}
                  onChange={(e) => setHalfDayHours(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Office Geofence for Camera Attendance */}
          <div className="border-t border-[var(--border-color)] pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-teal-600 dark:text-teal-400">
                2. Office Location & Geofence (Camera Attendance)
              </h2>
              <button
                type="button"
                onClick={handleUseCurrentGps}
                className="btn-secondary text-xs py-1 px-2.5"
              >
                📍 Use Current Browser GPS
              </button>
            </div>
            {gpsStatus && <p className="mt-1 text-xs text-teal-600 dark:text-teal-400">{gpsStatus}</p>}
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="setup-lat" className="block text-xs font-semibold mb-1">
                  Latitude
                </label>
                <input
                  id="setup-lat"
                  type="number"
                  step="any"
                  value={officeLat}
                  onChange={(e) => setOfficeLat(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="setup-lng" className="block text-xs font-semibold mb-1">
                  Longitude
                </label>
                <input
                  id="setup-lng"
                  type="number"
                  step="any"
                  value={officeLng}
                  onChange={(e) => setOfficeLng(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="setup-radius" className="block text-xs font-semibold mb-1">
                  Allowed Radius (Meters)
                </label>
                <input
                  id="setup-radius"
                  type="number"
                  min={20}
                  max={5000}
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="setup-addr" className="block text-xs font-semibold mb-1">
                  Office Address Label
                </label>
                <input
                  id="setup-addr"
                  type="text"
                  value={officeAddress}
                  onChange={(e) => setOfficeAddress(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Initial Departments & Leave Types */}
          <div className="border-t border-[var(--border-color)] pt-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-teal-600 dark:text-teal-400">
              3. Initial Departments & Leave Quotas (Customizable Later)
            </h2>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="setup-depts" className="block text-xs font-semibold mb-1">
                  Departments to create now (comma-separated, or leave blank)
                </label>
                <input
                  id="setup-depts"
                  type="text"
                  value={starterDeptNames}
                  onChange={(e) => setStarterDeptNames(e.target.value)}
                  placeholder="Engineering, Human Resources, Operations"
                  className="input-field"
                />
              </div>
              <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeStandardLeaveQuotas}
                  onChange={(e) => setIncludeStandardLeaveQuotas(e.target.checked)}
                />
                <span>
                  Configure standard yearly leave quotas (Annual: 14, Sick: 8, Casual: 10, Unpaid:
                  Unlimited)
                </span>
              </label>
            </div>
          </div>

          {/* Section 4: Primary Admin Account */}
          <div className="border-t border-[var(--border-color)] pt-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-teal-600 dark:text-teal-400">
              4. Primary Admin Login
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="admin-name" className="block text-xs font-semibold mb-1">
                  Admin Full Name *
                </label>
                <input
                  id="admin-name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="Ali Aamir"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="admin-email" className="block text-xs font-semibold mb-1">
                  Admin Email *
                </label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  spellCheck={false}
                  required
                  placeholder="admin@company.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="admin-password" className="block text-xs font-semibold mb-1">
                  Admin Password (min 6 chars) *
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="admin-password"
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={6}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="input-field"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="btn-secondary px-2.5 text-xs shrink-0"
                  >
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button type="submit" disabled={submitting} className="btn-primary px-6 py-2.5">
              {submitting ? "Initializing HCM Lite..." : "Initialize Company & Sign In →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


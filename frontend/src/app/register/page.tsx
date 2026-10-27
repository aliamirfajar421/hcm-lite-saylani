"use client";

import { useState } from "react";
import Link from "next/link";
import { registerApi } from "@/api/hcm";
import { getApiErrorMessage } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [department, setDepartment] = useState("Engineering");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setSubmitting(true);
    try {
      await registerApi({
        name,
        email,
        password,
        phone,
        department,
      });
      setSubmittedSuccess(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to submit registration"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col justify-start sm:justify-center px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        {/* Top Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 font-bold text-white shadow-sm">
              H
            </span>
            <div>
              <h1 className="text-lg font-bold leading-tight">HCM Lite</h1>
              <p className="text-xs text-muted">Employee Self-Registration</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {submittedSuccess ? (
          <div className="surface-card rounded-2xl p-6 shadow-sm space-y-4 text-center border border-teal-500/30">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-500/15 text-2xl">
              ⏳
            </div>
            <h2 className="text-lg font-bold text-teal-700 dark:text-teal-300">
              Registration Submitted!
            </h2>
            <div className="space-y-2 text-xs text-muted">
              <p>
                Your registration for <strong>{email}</strong> has been received and is currently{" "}
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  pending confirmation by Company Admin or HR
                </span>
                .
              </p>
              <p>
                Once an administrator approves your profile, you will be able to sign in immediately
                with your password.
              </p>
            </div>

            <div className="pt-3">
              <Link
                href="/login"
                className="btn-primary inline-flex items-center justify-center w-full py-2.5 text-xs font-semibold"
              >
                ← Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="surface-card rounded-2xl p-6 shadow-sm space-y-4 border border-default"
          >
            <div>
              <h2 className="text-base font-bold">Create Employee Account</h2>
              <p className="text-xs text-muted">
                Fill your details to register. Access will be activated upon Admin approval.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl bg-rose-500/15 p-3 text-xs font-medium text-rose-700 dark:text-rose-300"
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor="reg-name" className="block text-xs font-semibold mb-1">
                Full Name *
              </label>
              <input
                type="text"
                id="reg-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Usman Tariq"
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold mb-1">
                Work Email Address *
              </label>
              <input
                type="email"
                id="reg-email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usman@company.com"
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-dept" className="block text-xs font-semibold mb-1">
                  Department *
                </label>
                <select
                  id="reg-dept"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="input-field"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Human Resources">Human Resources</option>
                  <option value="Finance">Finance</option>
                  <option value="Product & Design">Product & Design</option>
                  <option value="Marketing & Growth">Marketing & Growth</option>
                </select>
              </div>

              <div>
                <label htmlFor="reg-phone" className="block text-xs font-semibold mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="reg-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="reg-password" className="block text-xs font-semibold">
                    Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  id="reg-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="reg-confirm" className="block text-xs font-semibold mb-1">
                  Confirm Password *
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  id="reg-confirm"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="input-field"
                />
              </div>
            </div>

            <div className="rounded-xl surface-subtle p-3 text-[11px] text-muted space-y-1 border border-default/50">
              <span className="font-semibold text-[var(--text-main)]">🔒 Admin Permission Required</span>
              <p>
                For company security, new accounts remain inactive until approved by your Company
                Admin.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-2.5 font-semibold text-xs"
            >
              {submitting ? "Submitting Registration..." : "Register Account"}
            </button>

            <div className="text-center pt-2">
              <p className="text-xs text-muted">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                >
                  Sign In here
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

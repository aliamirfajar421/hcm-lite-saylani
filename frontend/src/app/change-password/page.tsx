"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changePasswordApi } from "@/api/hcm";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/api";

export default function ChangePasswordPage() {
  const { user, updateUserLocal, logout } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const res = await changePasswordApi({ currentPassword, newPassword });
      updateUserLocal(res.user);
      setSuccess("Password updated! Redirecting to your dashboard...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 600);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not update password"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-md surface-card rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h1 className="text-lg font-bold">
            {user?.mustChangePassword ? "Set Your New Password" : "Change Password"}
          </h1>
          <p className="mt-1 text-xs text-muted">
            {user?.mustChangePassword
              ? "Security requirement: You signed in with a temporary password. Please set a new personal password to unlock your workspace."
              : "Update your account password."}
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-500/15 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl bg-emerald-500/15 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cur-pass" className="block text-xs font-semibold mb-1">
              Current / Temporary Password
            </label>
            <input
              id="cur-pass"
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="new-pass" className="block text-xs font-semibold">
                New Password (min 6 characters)
              </label>
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400"
              >
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="new-pass"
              type={showPass ? "text" : "password"}
              autoComplete="new-password"
              minLength={6}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            {!user?.mustChangePassword ? (
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="btn-secondary"
              >
                Back
              </button>
            ) : (
              <button type="button" onClick={() => void logout()} className="btn-secondary text-xs">
                Sign Out
              </button>
            )}
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Updating..." : "Save New Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginApi } from "@/api/hcm";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginPage() {
  const { initialized, loading, user, companyName, setSession } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (initialized === false) {
      router.replace("/setup");
      return;
    }
    if (user) {
      router.replace(user.mustChangePassword ? "/change-password" : "/dashboard");
    }
  }, [loading, initialized, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await loginApi({ email, password });
      setSession(data);
      router.push(data.user.mustChangePassword ? "/change-password" : "/dashboard");
    } catch (err) {
      setError(getApiErrorMessage(err, "Invalid email or password"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col justify-start sm:justify-center px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        {/* Top Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 font-bold text-white">
              H
            </span>
            <div>
              <h1 className="text-lg font-bold leading-tight">{companyName || "HCM Lite"}</h1>
              <p className="text-xs text-muted">Sign in to your workspace</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Sign-In Form at top so mobile keyboards never cover Sign In button */}
        <form onSubmit={handleSubmit} className="surface-card rounded-2xl p-6 shadow-sm space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-xl bg-rose-500/15 p-3 text-xs font-medium text-rose-700 dark:text-rose-300"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-semibold mb-1.5">
              Work Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="username"
              spellCheck={false}
              enterKeyHint="next"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="input-field"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="current-password" className="block text-xs font-semibold">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-controls="current-password"
                aria-pressed={showPassword}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
              >
                {showPassword ? "Hide password" : "Show password"}
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              id="current-password"
              name="password"
              autoComplete="current-password"
              enterKeyHint="done"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="input-field"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
            {submitting ? "Signing In..." : "Sign In"}
          </button>
        </form>

        {/* Secondary Help Info Underneath */}
        <div className="mt-5 rounded-xl surface-subtle p-4 text-xs text-muted space-y-1">
          <p className="font-semibold text-[var(--text-main)]">Role-Based Access (Admin · HR · Employee)</p>
          <p>
            Forgot your password or using a temporary password? Contact your Company{" "}
            <strong>Admin</strong> to reset your login. First-time HR and Employee logins will
            prompt you to set a private password immediately after signing in.
          </p>
        </div>
      </div>
    </div>
  );
}

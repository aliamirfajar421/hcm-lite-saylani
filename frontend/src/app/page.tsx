"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { initialized, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (initialized === false) {
      router.replace("/setup");
    } else if (!user) {
      router.replace("/login");
    } else if (user.mustChangePassword) {
      router.replace("/change-password");
    } else {
      router.replace("/dashboard");
    }
  }, [initialized, loading, user, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-3 border-teal-500 border-t-transparent" />
        <p className="mt-3 text-sm text-muted">Starting HCM Lite...</p>
      </div>
    </div>
  );
}

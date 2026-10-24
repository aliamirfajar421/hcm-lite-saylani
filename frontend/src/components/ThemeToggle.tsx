"use client";

import { useEffect, useState } from "react";

type StoredScheme = "light" | "dark" | null;

function applyMetaScheme(stored: StoredScheme) {
  if (typeof document === "undefined") return;
  let meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "color-scheme";
    document.head.appendChild(meta);
  }
  meta.content = stored ?? "light dark";
}

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [stored, setStored] = useState<StoredScheme>(null);
  const [osDark, setOsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setOsDark(mq.matches);

    try {
      const val = localStorage.getItem("color-scheme");
      if (val === "light" || val === "dark") {
        setStored(val);
        applyMetaScheme(val);
      }
    } catch {
      // Ignore storage restrictions
    }

    // Track OS preference for rendering current icon ONLY — NEVER delete stored preference here
    const onMqChange = (e: MediaQueryListEvent) => setOsDark(e.matches);
    mq.addEventListener("change", onMqChange);

    // Sync override across tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === "color-scheme") {
        const next = e.newValue === "light" || e.newValue === "dark" ? e.newValue : null;
        setStored(next);
        applyMetaScheme(next);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const currentRenderedDark = stored ? stored === "dark" : osDark;

  const handleToggle = () => {
    const target: "light" | "dark" = currentRenderedDark ? "light" : "dark";
    const systemScheme: "light" | "dark" = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

    // Check divergence ONLY at storage time: if target matches current OS scheme, clear stored override
    if (target === systemScheme) {
      try {
        localStorage.removeItem("color-scheme");
      } catch {}
      setStored(null);
      applyMetaScheme(null);
    } else {
      try {
        localStorage.setItem("color-scheme", target);
      } catch {}
      setStored(target);
      applyMetaScheme(target);
    }
  };

  if (!mounted) {
    return (
      <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" aria-label="Toggle theme">
        ◐
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={
        stored
          ? `Theme pinned to ${stored} (click to switch / reset to system)`
          : `Following system (${currentRenderedDark ? "dark" : "light"})`
      }
      aria-label={currentRenderedDark ? "Switch to light theme" : "Switch to dark theme"}
      className="btn-secondary px-2.5 py-1.5 text-xs"
    >
      <span aria-hidden="true">{currentRenderedDark ? "☀" : "☾"}</span>
      <span className="hidden sm:inline">{currentRenderedDark ? "Light" : "Dark"}</span>
    </button>
  );
}


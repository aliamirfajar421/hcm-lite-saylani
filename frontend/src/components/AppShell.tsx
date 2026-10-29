"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  listNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  UserRole,
} from "@/api/hcm";
import ThemeToggle from "./ThemeToggle";
import AiAssistantDrawer from "./AiAssistantDrawer";
import JudgeRoleSwitcher from "./JudgeRoleSwitcher";
import WhatsAppAlertSimulator from "./WhatsAppAlertSimulator";
import JudgeTourModal from "./JudgeTourModal";
import DigitalEmployeeBadge from "./DigitalEmployeeBadge";
import { useLanguage } from "@/context/LanguageContext";
import { sound } from "@/lib/audio";

interface NavItem {
  href: string;
  label: string;
  navKey: string;
  iconKey:
    | "dashboard"
    | "org"
    | "employees"
    | "profile"
    | "attendance"
    | "leaves"
    | "payroll"
    | "performance"
    | "announcements"
    | "audit";
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", navKey: "nav_dashboard", iconKey: "dashboard", roles: ["admin", "hr", "employee"] },
  { href: "/organization", label: "Organization & Rules", navKey: "nav_organization", iconKey: "org", roles: ["admin", "hr"] },
  { href: "/employees", label: "Employees", navKey: "nav_employees", iconKey: "employees", roles: ["admin", "hr"] },
  { href: "/employees", label: "My Profile", navKey: "nav_employees", iconKey: "profile", roles: ["employee"] },
  { href: "/attendance", label: "Attendance", navKey: "nav_attendance", iconKey: "attendance", roles: ["admin", "hr", "employee"] },
  { href: "/leaves", label: "Leave Management", navKey: "nav_leaves", iconKey: "leaves", roles: ["admin", "hr", "employee"] },
  { href: "/payroll", label: "Payroll & Payslips", navKey: "nav_payroll", iconKey: "payroll", roles: ["admin", "hr", "employee"] },
  { href: "/performance", label: "Performance & OKRs", navKey: "nav_performance", iconKey: "performance", roles: ["admin", "hr", "employee"] },
  { href: "/announcements", label: "Announcements", navKey: "nav_announcements", iconKey: "announcements", roles: ["admin", "hr", "employee"] },
  { href: "/audit-logs", label: "Audit Log", navKey: "nav_audit_logs", iconKey: "audit", roles: ["admin"] },
];

function GeminiHamburgerSvg() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function NavIcon({ iconKey }: { iconKey: NavItem["iconKey"] }) {
  switch (iconKey) {
    case "dashboard":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "org":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.02 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      );
    case "employees":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "profile":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "attendance":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "leaves":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "payroll":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case "performance":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
        </svg>
      );
    case "announcements":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 11 18-5v12L3 13v-2Z" />
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </svg>
      );
    case "audit":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
  }
}

export default function AppShell({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { initialized, loading, user, companyName, unreadNotifications, refreshMe, logout } =
    useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { language, toggleLanguage, t } = useLanguage();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };
  const [notifications, setNotifications] = useState<
    Array<{
      _id: string;
      title: string;
      message: string;
      isRead: boolean;
      link?: string;
      createdAt: string;
    }>
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement | null>(null);

  // Click outside to close notifications dropdown
  useEffect(() => {
    if (!notifOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notifOpen]);

  useEffect(() => {
    try {
      if (localStorage.getItem("hcm_sidebar_collapsed") === "1") {
        setSidebarCollapsed(true);
      }
    } catch {
      // Ignore storage restrictions
    }
  }, []);

  const toggleDesktopSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("hcm_sidebar_collapsed", next ? "1" : "0");
      } catch {
        // Ignore storage restrictions
      }
      return next;
    });
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    setUnreadCount(unreadNotifications);
  }, [unreadNotifications]);

  useEffect(() => {
    if (loading) return;
    if (initialized === false) {
      router.replace("/setup");
      return;
    }
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.mustChangePassword && pathname !== "/change-password") {
      router.replace("/change-password");
      return;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [loading, initialized, user, pathname, allowedRoles, router]);

  const loadNotifications = async () => {
    try {
      const res = await listNotificationsApi();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // Ignore transient error
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-3 border-teal-500 border-t-transparent" />
          <p className="mt-3 text-sm text-muted">Loading HCM Lite workspace...</p>
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  const roleBadgeClass =
    user.role === "admin"
      ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
      : user.role === "hr"
      ? "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30"
      : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* Gemini-Style Collapsible Role-Scoped Sidebar */}
      <aside
        id="hcm-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex h-[100svh] w-72 flex-col border-r border-[var(--border-color)] bg-[var(--bg-surface)] transition-[width,transform] duration-200 ease-out lg:sticky lg:top-0 lg:translate-x-0 ${
          sidebarCollapsed ? "lg:w-[72px]" : "lg:w-64"
        } ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Top Rail Row: Gemini Circular Hamburger + Brand */}
        <div
          className={`flex items-center border-b border-[var(--border-color)] py-3 ${
            sidebarCollapsed ? "lg:justify-center lg:px-2 px-4 justify-between" : "justify-between px-3.5"
          }`}
        >
          {sidebarCollapsed ? (
            /* Collapsed Desktop: Company Logo Button that EXPANDS on click */
            <div className="hidden lg:flex items-center justify-center">
              <button
                type="button"
                onClick={toggleDesktopSidebar}
                aria-label="Expand navigation menu"
                title={`${companyName || "Saylani Tech"} (Click to expand menu)`}
                className="group relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-black text-xs shadow-md hover:scale-105 transition cursor-pointer"
              >
                <span>{(companyName || "ST").slice(0, 2).toUpperCase()}</span>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 border border-teal-400 text-[8px] text-teal-300 group-hover:scale-110 transition">
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
              </button>
            </div>
          ) : null}

          {/* Expanded Desktop & Mobile Row */}
          <div className={`flex items-center gap-2 min-w-0 ${sidebarCollapsed ? "lg:hidden" : "w-full justify-between"}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={toggleDesktopSidebar}
                aria-label="Collapse navigation menu"
                title="Collapse menu"
                className="gemini-icon-btn hidden lg:inline-flex"
              >
                <GeminiHamburgerSvg />
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="gemini-icon-btn lg:hidden"
              >
                <GeminiHamburgerSvg />
              </button>

              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 min-w-0 hover:opacity-90 transition"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 font-black text-xs text-white shadow-xs">
                  {(companyName || "ST").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold leading-tight">{companyName || "Saylani Tech"}</p>
                  <p className="truncate text-[11px] text-muted">HCM Lite · AI HR</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Gemini-Style Quick AI Action Pill right below Hamburger */}
        <div className={`px-3 pt-3 ${sidebarCollapsed ? "lg:px-2" : ""}`}>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setAiOpen(true);
            }}
            title="Open HCM Lite AI Chat"
            className={`flex items-center gap-2.5 rounded-full border border-teal-500/30 bg-teal-500/10 text-sm font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-colors cursor-pointer ${
              sidebarCollapsed
                ? "lg:mx-auto lg:h-11 lg:w-11 lg:justify-center lg:px-0 w-full px-4 py-2.5"
                : "w-full px-4 py-2.5"
            }`}
          >
            <span aria-hidden="true" className="text-base leading-none">
              ✦
            </span>
            <span className={sidebarCollapsed ? "lg:hidden" : ""}>Ask HCM AI</span>
          </button>
        </div>

        {/* Navigation Links (Pill-shaped like Google Gemini) */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Main navigation">
          {visibleNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                title={sidebarCollapsed ? item.label : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-full text-sm font-medium transition-colors ${
                  sidebarCollapsed
                    ? "lg:mx-auto lg:h-11 lg:w-11 lg:justify-center lg:px-0 px-3.5 py-2.5"
                    : "px-3.5 py-2.5"
                } ${
                  active
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-[var(--text-main)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                <NavIcon iconKey={item.iconKey} />
                <span className={`truncate ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                  {t(item.navKey, item.label)}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer (Adapts to Collapsed / Expanded state) */}
        <div className="border-t border-[var(--border-color)] p-3 space-y-2">
          <div
            className={`rounded-2xl surface-subtle p-2.5 ${
              sidebarCollapsed ? "lg:flex lg:justify-center lg:p-1.5" : ""
            }`}
            title={sidebarCollapsed ? `${user?.name || user?.email || "User"} (${(user?.role || "").toUpperCase()})` : undefined}
          >
            <div className={`hidden ${sidebarCollapsed ? "lg:flex" : ""} h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white`}>
              {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className={sidebarCollapsed ? "lg:hidden" : ""}>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-bold">{user?.name || user?.email || "User"}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${roleBadgeClass}`}
                >
                  {user?.role}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted">{user?.email || ""}</p>
            </div>
          </div>

          <div className={`flex gap-2 ${sidebarCollapsed ? "lg:flex-col lg:items-center" : ""}`}>
            <Link
              href="/change-password"
              title="Change Password"
              className={`btn-secondary py-2 text-center text-xs flex items-center justify-center gap-1.5 ${
                sidebarCollapsed ? "lg:w-10 lg:h-10 lg:p-0 flex-1" : "flex-1"
              }`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7.5" cy="15.5" r="4.5" />
                <path d="M21 2l-9.6 9.6M15.5 7.5l3 3M18.5 4.5l3 3" />
              </svg>
              <span className={sidebarCollapsed ? "lg:hidden" : ""}>Password</span>
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              title="Sign Out"
              className={`btn-secondary py-2 text-xs text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 ${
                sidebarCollapsed ? "lg:w-10 lg:h-10 lg:p-0 flex-1" : "flex-1"
              }`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className={sidebarCollapsed ? "lg:hidden" : ""}>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)]/95 px-4 py-2.5 backdrop-blur-xs sm:px-6">
          <div className="flex items-center gap-2">
            {/* Mobile-Only Gemini Circular Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="hcm-sidebar"
              className="gemini-icon-btn lg:hidden"
            >
              <GeminiHamburgerSvg />
            </button>

            <span className="text-sm font-semibold text-muted truncate">
              {companyName || "HCM Lite"} <span className="hidden sm:inline">· Saylani Hackathon</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Assistant Trigger */}
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="btn-primary rounded-full px-3.5 py-1.5 text-xs"
            >
              <span aria-hidden="true">✦</span>
              <span>Ask AI</span>
            </button>

            {/* Notifications Dropdown with Click-Outside Closure */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  const next = !notifOpen;
                  setNotifOpen(next);
                  if (next) void loadNotifications();
                }}
                aria-label="In-app notifications"
                aria-expanded={notifOpen}
                className="gemini-icon-btn relative"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl surface-card shadow-xl z-40 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[var(--border-color)] px-3.5 py-2.5">
                    <span className="text-xs font-bold">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          await markAllNotificationsReadApi();
                          setUnreadCount(0);
                          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                          void refreshMe();
                        }}
                        className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border-color)]">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-xs text-muted">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n._id}
                          onClick={async () => {
                            if (!n.isRead) {
                              await markNotificationReadApi(n._id);
                              setUnreadCount((c) => Math.max(0, c - 1));
                              setNotifications((prev) =>
                                prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x))
                              );
                            }
                            setNotifOpen(false);
                            if (n.link) router.push(n.link);
                          }}
                          className={`cursor-pointer px-3.5 py-2.5 text-xs hover:bg-[var(--bg-subtle)] ${
                            !n.isRead ? "bg-teal-500/5" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold">{n.title}</p>
                            {!n.isRead && (
                              <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                            )}
                          </div>
                          <p className="mt-0.5 text-muted">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-[var(--border-color)] p-2 bg-[var(--bg-subtle)] text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        setWhatsAppOpen(true);
                      }}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center justify-center gap-1.5 w-full"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                        <line x1="12" y1="18" x2="12.01" y2="18" />
                      </svg>
                      <span>Preview Simulated WhatsApp Alerts</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Judge Tour / Presentation Fast Cheat-Sheet */}
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setTourOpen(true);
              }}
              className="rounded-full border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 transition flex items-center gap-1.5 shadow-xs"
              title="60-Second Presentation Tour & Evaluation Cheat-Sheet"
            >
              <span>🚀</span>
              <span className="hidden sm:inline">Judge Tour</span>
            </button>

            {/* PWA Mobile App Install Pill (If browser supports) */}
            {deferredPrompt && (
              <button
                type="button"
                onClick={handleInstallPwa}
                className="rounded-full border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 transition flex items-center gap-1.5 shadow-xs"
                title="Install HCM Lite as Native Mobile App"
              >
                <span>📱</span>
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}

            {/* Bilingual Language Switcher */}
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                toggleLanguage();
              }}
              className="rounded-full border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 px-3 py-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 transition flex items-center gap-1.5 shadow-xs"
              title="Switch English / Roman Urdu"
            >
              <span>🌐</span>
              <span className="text-[11px] font-extrabold uppercase">{language === "en" ? "EN" : "Roman Urdu"}</span>
            </button>

            <ThemeToggle />
          </div>
        </header>

        {/* Page Body */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {/* Judge & Presentation Floating Fast-Switcher */}
      <JudgeRoleSwitcher />

      {/* Simulated WhatsApp Omnichannel Alert Modal */}
      <WhatsAppAlertSimulator
        open={whatsAppOpen}
        onClose={() => setWhatsAppOpen(false)}
        userName={user?.name || user?.email || "Team Member"}
      />

      {/* Global Gemini/ChatGPT-Style AI Assistant Studio */}
      <AiAssistantDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        role={user.role}
        userName={user?.name || user?.email || "User"}
        userId={user.id}
      />

      {/* 60-Second Fast Presentation Tour for Judges */}
      <JudgeTourModal
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        onOpenAiDrawer={() => setAiOpen(true)}
        onOpenBadge={() => setBadgeModalOpen(true)}
      />

      {/* Smart ID Badge Triggered from Tour or Cockpit */}
      <DigitalEmployeeBadge
        open={badgeModalOpen}
        onClose={() => setBadgeModalOpen(false)}
        employeeData={{
          fullName: user?.name,
          email: user?.email,
          employeeCode: "EMP001",
          designation: "Software Engineer",
          department: "Engineering",
          bloodGroup: "O+",
          joiningDate: "2026-01-15",
        }}
        companyName={companyName || "Saylani Tech"}
      />
    </div>
  );
}

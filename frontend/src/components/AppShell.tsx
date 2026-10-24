"use client";

import { ReactNode, useEffect, useState } from "react";
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

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "◫", roles: ["admin", "hr", "employee"] },
  { href: "/organization", label: "Organization & Rules", icon: "⚙", roles: ["admin", "hr"] },
  { href: "/employees", label: "Employees", icon: "👥", roles: ["admin", "hr"] },
  { href: "/employees", label: "My Profile", icon: "👤", roles: ["employee"] },
  { href: "/attendance", label: "Attendance", icon: "⏱", roles: ["admin", "hr", "employee"] },
  { href: "/leaves", label: "Leave Management", icon: "🗓", roles: ["admin", "hr", "employee"] },
  { href: "/payroll", label: "Payroll & Payslips", icon: "💳", roles: ["admin", "hr", "employee"] },
  { href: "/announcements", label: "Announcements", icon: "📢", roles: ["admin", "hr", "employee"] },
  { href: "/audit-logs", label: "Audit Log", icon: "🛡", roles: ["admin"] },
];

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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
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
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
        />
      )}

      {/* Role-Scoped Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--border-color)] bg-[var(--bg-surface)] transition-transform lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 font-bold text-white">
              H
            </span>
            <div>
              <p className="text-sm font-bold leading-tight">{companyName}</p>
              <p className="text-[11px] text-muted">HCM Lite · AI HR</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
            className="rounded-lg p-1 text-muted lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          {visibleNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-[var(--text-main)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                <span aria-hidden="true" className="textbase">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border-color)] p-4 space-y-2.5">
          <div className="rounded-xl surface-subtle p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-bold">{user.name}</p>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${roleBadgeClass}`}
              >
                {user.role}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted">{user.email}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/change-password"
              className="btn-secondary flex-1 py-1.5 text-center text-xs"
            >
              Password
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="btn-secondary flex-1 py-1.5 text-xs text-rose-600 dark:text-rose-400"
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)]/95 px-4 py-3 backdrop-blur-xs sm:px-6">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="btn-secondary px-2.5 py-1.5 lg:hidden"
            >
              ☰
            </button>
            <span className="hidden sm:inline-block text-sm font-semibold text-muted">
              Saylani Hackathon · HCM Lite
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Assistant Trigger */}
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              <span>✦</span>
              <span>Ask AI</span>
            </button>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const next = !notifOpen;
                  setNotifOpen(next);
                  if (next) void loadNotifications();
                }}
                aria-label="In-app notifications"
                className="btn-secondary relative px-2.5 py-1.5 text-xs"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl surface-card shadow-xl z-40 overflow-hidden">
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
                </div>
              )}
            </div>

            <ThemeToggle />
          </div>
        </header>

        {/* Page Body */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {/* Global Slide-Over AI Assistant */}
      <AiAssistantDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        role={user.role}
        userName={user.name}
      />
    </div>
  );
}


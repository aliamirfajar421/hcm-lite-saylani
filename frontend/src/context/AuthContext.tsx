"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  AuthUser,
  getMeApi,
  getSetupStatusApi,
  logoutApi,
} from "@/api/hcm";

interface AuthContextValue {
  initialized: boolean | null;
  loading: boolean;
  user: AuthUser | null;
  companyName: string;
  currency: string;
  unreadNotifications: number;
  setSession: (payload: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    companyName?: string;
  }) => void;
  updateUserLocal: (user: AuthUser) => void;
  refreshMe: () => Promise<void>;
  refreshSetupStatus: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [companyName, setCompanyName] = useState("HCM Lite");
  const [currency, setCurrency] = useState("PKR");
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const refreshSetupStatus = useCallback(async () => {
    try {
      const status = await getSetupStatusApi();
      setInitialized(status.initialized);
      if (status.companyName) setCompanyName(status.companyName);
      return status.initialized;
    } catch {
      // Keep non-blocking if backend is waking up
      setInitialized(true);
      return true;
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const data = await getMeApi();
      setUser(data.user);
      if (data.companyName) setCompanyName(data.companyName);
      if (data.currency) setCurrency(data.currency);
      setUnreadNotifications(data.unreadNotifications || 0);
    } catch {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const isInit = await refreshSetupStatus();
      if (!active) return;
      if (isInit) {
        await refreshMe();
      } else {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setUser(null);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refreshSetupStatus, refreshMe]);

  const setSession = useCallback(
    (payload: {
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
      companyName?: string;
    }) => {
      localStorage.setItem("accessToken", payload.accessToken);
      localStorage.setItem("refreshToken", payload.refreshToken);
      setInitialized(true);
      setUser(payload.user);
      if (payload.companyName) setCompanyName(payload.companyName);
    },
    []
  );

  const updateUserLocal = useCallback((nextUser: AuthUser) => {
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        initialized,
        loading,
        user,
        companyName,
        currency,
        unreadNotifications,
        setSession,
        updateUserLocal,
        refreshMe,
        refreshSetupStatus,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

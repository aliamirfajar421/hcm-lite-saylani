"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Language = "en" | "ur";

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const translations: Record<string, Record<Language, string>> = {
  // Navigation
  nav_dashboard: { en: "Dashboard", ur: "Dashboard" },
  nav_organization: { en: "Organization", ur: "Idara Settings" },
  nav_employees: { en: "Employees", ur: "Mulazmeen" },
  nav_attendance: { en: "Attendance", ur: "Hazri Board" },
  nav_leaves: { en: "Leaves", ur: "Chuttiyan" },
  nav_payroll: { en: "Payroll", ur: "Tanwah (Payroll)" },
  nav_performance: { en: "Performance", ur: "Karkardagi (OKRs)" },
  nav_announcements: { en: "Announcements", ur: "Aelanaat" },
  nav_audit_logs: { en: "Audit Logs", ur: "Security Logs" },

  // Header & User Actions
  ask_ai: { en: "Ask AI", ur: "AI Se Puchein" },
  sign_out: { en: "Sign Out", ur: "Log Out Karein" },
  change_password: { en: "Change Password", ur: "Password Badlein" },
  light_mode: { en: "Light", ur: "Light" },
  dark_mode: { en: "Dark", ur: "Dark" },

  // Dashboard Common
  web_check_in: { en: "⏱ Web Check-In", ur: "⏱ Hazri Lagayein" },
  camera_check_in: { en: "📷 Camera + GPS Check-In", ur: "📷 Chehra + GPS Hazri" },
  smart_ai_leave: { en: "✦ Smart AI Leave", ur: "✦ AI Chutti Request" },
  smart_id_badge: { en: "Smart ID Badge", ur: "Digital ID Card" },
  executive_report: { en: "Executive Report", ur: "Official Report" },
  company_rules: { en: "Company Rules", ur: "Company Qawaid" },
  finalize_payroll: { en: "Finalize Payroll", ur: "Tanwah Manzoor Karein" },

  // KPIs
  active_headcount: { en: "Active Headcount", ur: "Kul Mulazmeen" },
  monthly_payroll_budget: { en: "Monthly Payroll Budget", ur: "Mahana Tanwah Budget" },
  average_salary: { en: "Average Gross Salary", ur: "Ausat Tanwah" },
  attrition_rate: { en: "Attrition Rate YTD", ur: "Naukri Chorne Ki Sharah" },
  present_today: { en: "Present Today", ur: "Aaj Hazir Mulazim" },
  on_leave_today: { en: "On Leave Today", ur: "Aaj Chutti Par" },
  late_arrivals: { en: "Late Arrivals Today", ur: "Aaj Late Aane Wale" },
  pending_approvals: { en: "Pending Approvals", ur: "Zair-e-Ghor Requests" },

  // Employee Hero
  streak_title: { en: "18-Day On-Time Streak!", ur: "18 Din Musalsal Waqt Par Hazri!" },
  send_kudos: { en: "+ Send Kudos", ur: "+ Tareef / Kudos Bhejein" },
  hours_this_week: { en: "Hours This Week vs 40h", ur: "Is Hafte Ke Kaam Ke Ghante" },
  download_pdf: { en: "⬇ PDF Payslip", ur: "⬇ Payslip PDF Download" },
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  toggleLanguage: () => {},
  setLanguage: () => {},
  t: (_key, fallback) => fallback || _key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("hcm_language") as Language | null;
    if (saved === "en" || saved === "ur") {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("hcm_language", lang);
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "ur" : "en");
  };

  const t = (key: string, fallback?: string): string => {
    if (translations[key] && translations[key][language]) {
      return translations[key][language];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);


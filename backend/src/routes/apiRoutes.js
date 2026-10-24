import { Router } from "express";
import auth, { requireRole, requirePasswordChanged } from "../middlewares/auth.js";

import {
  getSetupStatus,
  firstRunSetup,
  login,
  refresh,
  logout,
  me,
  changePassword,
  enrollFaceDescriptor,
  listUsers,
  createHrLogin,
  toggleUserStatus,
  resetUserPassword,
} from "../controllers/authController.js";

import {
  getCompanySettings,
  updateCompanySettings,
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  listDesignations,
  createDesignation,
  deleteDesignation,
  listLeaveTypes,
  createLeaveType,
  updateLeaveType,
  listHolidays,
  createHoliday,
  deleteHoliday,
} from "../controllers/orgController.js";

import {
  registerEmployee,
  listEmployees,
  getEmployee360,
  updateEmployee,
  updateOwnContact,
  updateSalaryStructure,
  importEmployeesCsv,
  exportEmployeesCsv,
} from "../controllers/employeeController.js";

import {
  checkIn,
  checkOut,
  getAttendanceCalendar,
  getDailyBoard,
  requestCorrection,
  listCorrections,
  reviewCorrection,
} from "../controllers/attendanceController.js";

import {
  getMyLeaveBalances,
  applyLeave,
  cancelLeave,
  listLeaveRequests,
  reviewLeaveRequest,
} from "../controllers/leaveController.js";

import {
  generatePayrollDraft,
  listPayrollRuns,
  getPayrollRunById,
  finalizePayrollRun,
  listPayslips,
  downloadPayslipPdf,
} from "../controllers/payrollController.js";

import {
  getDashboardData,
  aiChat,
  aiSummarizeDashboard,
  aiSmartLeave,
  listAnnouncements,
  createAnnouncement,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  listAuditLogs,
} from "../controllers/dashboardAiCommsController.js";

const router = Router();

// ==================== M1: Auth & Access ====================
router.get("/auth/setup-status", getSetupStatus);
router.post("/auth/setup", firstRunSetup);
router.post("/auth/login", login);
router.post("/auth/refresh", refresh);
router.post("/auth/logout", auth, logout);
router.get("/auth/me", auth, me);
router.post("/auth/change-password", auth, changePassword);
router.post("/auth/enroll-face", auth, requirePasswordChanged, enrollFaceDescriptor);

// Admin User & Login Management (#05)
router.get("/auth/users", auth, requirePasswordChanged, requireRole("admin"), listUsers);
router.post("/auth/users/hr", auth, requirePasswordChanged, requireRole("admin"), createHrLogin);
router.patch("/auth/users/:id/status", auth, requirePasswordChanged, requireRole("admin"), toggleUserStatus);
router.post("/auth/users/:id/reset-password", auth, requirePasswordChanged, requireRole("admin"), resetUserPassword);

// ==================== M2: Organization Setup ====================
router.get("/org/settings", auth, requirePasswordChanged, getCompanySettings);
router.put("/org/settings", auth, requirePasswordChanged, requireRole("admin"), updateCompanySettings);

router.get("/org/departments", auth, requirePasswordChanged, listDepartments);
router.post("/org/departments", auth, requirePasswordChanged, requireRole("admin"), createDepartment);
router.put("/org/departments/:id", auth, requirePasswordChanged, requireRole("admin"), updateDepartment);
router.delete("/org/departments/:id", auth, requirePasswordChanged, requireRole("admin"), deleteDepartment);

router.get("/org/designations", auth, requirePasswordChanged, listDesignations);
router.post("/org/designations", auth, requirePasswordChanged, requireRole("admin"), createDesignation);
router.delete("/org/designations/:id", auth, requirePasswordChanged, requireRole("admin"), deleteDesignation);

router.get("/org/leave-types", auth, requirePasswordChanged, listLeaveTypes);
router.post("/org/leave-types", auth, requirePasswordChanged, requireRole("admin"), createLeaveType);
router.put("/org/leave-types/:id", auth, requirePasswordChanged, requireRole("admin"), updateLeaveType);

router.get("/org/holidays", auth, requirePasswordChanged, listHolidays);
router.post("/org/holidays", auth, requirePasswordChanged, requireRole("admin"), createHoliday);
router.delete("/org/holidays/:id", auth, requirePasswordChanged, requireRole("admin"), deleteHoliday);

// ==================== M3: Employees ====================
router.get("/employees/export", auth, requirePasswordChanged, requireRole("hr"), exportEmployeesCsv);
router.post("/employees/import", auth, requirePasswordChanged, requireRole("hr"), importEmployeesCsv);
router.patch("/employees/me/contact", auth, requirePasswordChanged, requireRole("employee"), updateOwnContact);

router.get("/employees", auth, requirePasswordChanged, listEmployees);
router.post("/employees", auth, requirePasswordChanged, requireRole("hr"), registerEmployee);
router.get("/employees/:id", auth, requirePasswordChanged, getEmployee360);
router.put("/employees/:id", auth, requirePasswordChanged, requireRole("hr"), updateEmployee);
router.put("/employees/:id/salary", auth, requirePasswordChanged, requireRole("hr"), updateSalaryStructure);

// ==================== M4: Attendance ====================
router.post("/attendance/check-in", auth, requirePasswordChanged, requireRole("hr", "employee"), checkIn);
router.post("/attendance/check-out", auth, requirePasswordChanged, requireRole("hr", "employee"), checkOut);
router.get("/attendance/calendar", auth, requirePasswordChanged, getAttendanceCalendar);
router.get("/attendance/board", auth, requirePasswordChanged, requireRole("admin", "hr"), getDailyBoard);

router.post("/attendance/corrections", auth, requirePasswordChanged, requireRole("hr", "employee"), requestCorrection);
router.get("/attendance/corrections", auth, requirePasswordChanged, listCorrections);
router.patch("/attendance/corrections/:id/review", auth, requirePasswordChanged, requireRole("hr"), reviewCorrection);

// ==================== M5: Leave ====================
router.get("/leaves/balances", auth, requirePasswordChanged, getMyLeaveBalances);
router.get("/leaves", auth, requirePasswordChanged, listLeaveRequests);
router.post("/leaves", auth, requirePasswordChanged, requireRole("hr", "employee"), applyLeave);
router.patch("/leaves/:id/cancel", auth, requirePasswordChanged, requireRole("hr", "employee"), cancelLeave);
router.patch("/leaves/:id/review", auth, requirePasswordChanged, requireRole("hr"), reviewLeaveRequest);

// ==================== M6: Payroll Lite ====================
router.get("/payroll/runs", auth, requirePasswordChanged, requireRole("admin", "hr"), listPayrollRuns);
router.post("/payroll/runs", auth, requirePasswordChanged, requireRole("hr"), generatePayrollDraft);
router.get("/payroll/runs/:id", auth, requirePasswordChanged, requireRole("admin", "hr"), getPayrollRunById);
router.post("/payroll/runs/:id/finalize", auth, requirePasswordChanged, requireRole("admin"), finalizePayrollRun);

router.get("/payroll/payslips", auth, requirePasswordChanged, listPayslips);
router.get("/payroll/payslips/:id/pdf", auth, requirePasswordChanged, downloadPayslipPdf);

// ==================== M7: Dashboards & Analytics ====================
router.get("/dashboard", auth, requirePasswordChanged, getDashboardData);

// ==================== M8: AI Assistant ====================
router.post("/ai/chat", auth, requirePasswordChanged, aiChat);
router.post("/ai/summarize", auth, requirePasswordChanged, requireRole("admin", "hr"), aiSummarizeDashboard);
router.post("/ai/smart-leave", auth, requirePasswordChanged, requireRole("hr", "employee"), aiSmartLeave);

// ==================== M9: Comms & Audit ====================
router.get("/announcements", auth, requirePasswordChanged, listAnnouncements);
router.post("/announcements", auth, requirePasswordChanged, requireRole("admin", "hr"), createAnnouncement);

router.get("/notifications", auth, requirePasswordChanged, listNotifications);
router.patch("/notifications/read-all", auth, requirePasswordChanged, markAllNotificationsRead);
router.patch("/notifications/:id/read", auth, requirePasswordChanged, markNotificationRead);

router.get("/audit-logs", auth, requirePasswordChanged, requireRole("admin"), listAuditLogs);

export default router;


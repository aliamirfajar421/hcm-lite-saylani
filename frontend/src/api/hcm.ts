import api, { downloadAuthenticatedBlob } from "@/lib/api";

export type UserRole = "admin" | "hr" | "employee";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string | null;
  mustChangePassword?: boolean;
  hasEnrolledFace?: boolean;
}

export interface CompanySettings {
  _id?: string;
  companyName: string;
  tagline?: string;
  currency: string;
  timezone: string;
  officeStartTime: string;
  officeEndTime: string;
  graceMinutes: number;
  halfDayHours: number;
  weekendDays: number[];
  officeLocation: {
    lat: number;
    lng: number;
    address: string;
    radiusMeters: number;
  };
  storeAttendancePhoto?: boolean;
  latePenaltyEnabled: boolean;
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

export interface Designation {
  _id: string;
  title: string;
  level: string;
  departmentId?: { _id: string; name: string; code: string } | null;
  isActive: boolean;
}

export interface LeaveType {
  _id: string;
  name: string;
  code: string;
  yearlyQuota: number;
  isPaid: boolean;
  isUnlimited: boolean;
  description?: string;
  isActive: boolean;
}

export interface Holiday {
  _id: string;
  name: string;
  date: string;
  description?: string;
}

export interface SalaryStructure {
  basic: number;
  hraPercent: number;
  medicalPercent: number;
  hra: number;
  medical: number;
  otherAllowances: number;
  gross: number;
}

export interface EmployeeRecord {
  _id: string;
  userId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  gender: "male" | "female" | "other";
  departmentId?: { _id: string; name: string; code: string } | null;
  designationId?: { _id: string; title: string; level?: string } | null;
  joiningDate: string;
  exitDate?: string | null;
  employmentStatus: "active" | "probation" | "exited";
  salaryStructure: SalaryStructure;
}

export interface LeaveBalanceItem {
  leaveTypeId: string;
  code: string;
  name: string;
  isPaid: boolean;
  isUnlimited: boolean;
  quota: number | null;
  approvedDays: number;
  pendingDays: number;
  remaining: number | null;
}

export interface PayslipRecord {
  _id: string;
  payrollRunId: string;
  employeeId: string;
  userId: string;
  month: number;
  year: number;
  status: "draft" | "finalized";
  employeeSnapshot: {
    employeeCode: string;
    fullName: string;
    email: string;
    departmentName: string;
    designationTitle: string;
    joiningDate: string;
  };
  basic: number;
  hra: number;
  medical: number;
  otherAllowances: number;
  gross: number;
  proratedGross: number;
  workingDaysInMonth: number;
  eligibleWorkingDays: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  halfDays: number;
  lateCount: number;
  latePenaltyDays: number;
  deductibleDays: number;
  perDayRate: number;
  attendanceDeduction: number;
  annualizedGross: number;
  annualTax: number;
  monthlyTax: number;
  netPay: number;
}

// ==================== M1: Auth & Setup ====================
export const getSetupStatusApi = async () => {
  const { data } = await api.get<{ initialized: boolean; companyName: string | null }>(
    "/auth/setup-status"
  );
  return data;
};

export const firstRunSetupApi = async (payload: Record<string, unknown>) => {
  const { data } = await api.post<{
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    companyName: string;
  }>("/auth/setup", payload);
  return data;
};

export const seedDemoAccountsApi = async () => {
  const { data } = await api.post<{
    success: boolean;
    message: string;
    accounts: Array<{ role: string; email: string; password: string; name: string }>;
  }>("/auth/seed-demo");
  return data;
};

export const seedRichDemoApi = async () => {
  const { data } = await api.post<{
    success: boolean;
    message: string;
  }>("/auth/seed-rich-demo");
  return data;
};

export const registerApi = async (payload: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  department?: string;
}) => {
  const { data } = await api.post<{
    success: boolean;
    message: string;
  }>("/auth/register", payload);
  return data;
};

export const listPendingUsersApi = async () => {
  const { data } = await api.get<{
    pendingUsers: Array<{
      _id: string;
      name: string;
      email: string;
      role: string;
      requestedDepartment?: string;
      requestedPhone?: string;
      createdAt: string;
    }>;
  }>("/auth/pending-users");
  return data;
};

export const simulatePendingUserApi = async () => {
  const { data } = await api.post<{
    success: boolean;
    message: string;
    user: {
      _id: string;
      name: string;
      email: string;
      requestedDepartment: string;
      requestedPhone: string;
      createdAt: string;
    };
  }>("/auth/pending-users/simulate");
  return data;
};

export const approveUserRegistrationApi = async (userId: string) => {
  const { data } = await api.patch<{
    success: boolean;
    message: string;
  }>(`/auth/users/${userId}/approve`);
  return data;
};

export const rejectUserRegistrationApi = async (userId: string) => {
  const { data } = await api.patch<{
    success: boolean;
    message: string;
  }>(`/auth/users/${userId}/reject`);
  return data;
};

export const loginApi = async (payload: { email: string; password: string }) => {
  const { data } = await api.post<{
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    companyName: string;
  }>("/auth/login", payload);
  return data;
};

export const logoutApi = async () => {
  const { data } = await api.post("/auth/logout");
  return data;
};

export const getMeApi = async () => {
  const { data } = await api.get<{
    user: AuthUser;
    companyName: string;
    currency: string;
    unreadNotifications: number;
  }>("/auth/me");
  return data;
};

export const changePasswordApi = async (payload: {
  currentPassword: string;
  newPassword: string;
}) => {
  const { data } = await api.post<{ message: string; user: AuthUser }>(
    "/auth/change-password",
    payload
  );
  return data;
};

export const enrollFaceApi = async (descriptor: number[]) => {
  const { data } = await api.post<{ message: string }>("/auth/enroll-face", { descriptor });
  return data;
};

export const listUsersApi = async () => {
  const { data } = await api.get<{
    users: Array<{
      _id: string;
      name: string;
      email: string;
      role: UserRole;
      isActive: boolean;
      mustChangePassword: boolean;
      createdAt: string;
      employeeId?: { employeeCode: string; fullName: string; employmentStatus: string } | null;
    }>;
  }>("/auth/users");
  return data.users;
};

export const createHrLoginApi = async (payload: {
  name: string;
  email: string;
  temporaryPassword: string;
}) => {
  const { data } = await api.post("/auth/users/hr", payload);
  return data;
};

export const toggleUserStatusApi = async (id: string, isActive: boolean) => {
  const { data } = await api.patch(`/auth/users/${id}/status`, { isActive });
  return data;
};

export const resetUserPasswordApi = async (id: string, temporaryPassword: string) => {
  const { data } = await api.post(`/auth/users/${id}/reset-password`, { temporaryPassword });
  return data;
};

// ==================== M2: Organization Setup ====================
export const getCompanySettingsApi = async () => {
  const { data } = await api.get<{ settings: CompanySettings | null }>("/org/settings");
  return data.settings;
};

export const updateCompanySettingsApi = async (payload: Partial<CompanySettings>) => {
  const { data } = await api.put<{ message: string; settings: CompanySettings }>(
    "/org/settings",
    payload
  );
  return data;
};

export const listDepartmentsApi = async () => {
  const { data } = await api.get<{ departments: Department[] }>("/org/departments");
  return data.departments;
};

export const createDepartmentApi = async (payload: {
  name: string;
  code: string;
  description?: string;
}) => {
  const { data } = await api.post<{ department: Department }>("/org/departments", payload);
  return data.department;
};

export const deleteDepartmentApi = async (id: string) => {
  const { data } = await api.delete(`/org/departments/${id}`);
  return data;
};

export const listDesignationsApi = async () => {
  const { data } = await api.get<{ designations: Designation[] }>("/org/designations");
  return data.designations;
};

export const createDesignationApi = async (payload: {
  title: string;
  departmentId?: string;
  level?: string;
}) => {
  const { data } = await api.post<{ designation: Designation }>("/org/designations", payload);
  return data.designation;
};

export const deleteDesignationApi = async (id: string) => {
  const { data } = await api.delete(`/org/designations/${id}`);
  return data;
};

export const listLeaveTypesApi = async () => {
  const { data } = await api.get<{ leaveTypes: LeaveType[] }>("/org/leave-types");
  return data.leaveTypes;
};

export const createLeaveTypeApi = async (payload: {
  name: string;
  code: string;
  yearlyQuota: number;
  isPaid: boolean;
  isUnlimited: boolean;
}) => {
  const { data } = await api.post<{ leaveType: LeaveType }>("/org/leave-types", payload);
  return data.leaveType;
};

export const updateLeaveTypeApi = async (id: string, payload: Partial<LeaveType>) => {
  const { data } = await api.put<{ leaveType: LeaveType }>(`/org/leave-types/${id}`, payload);
  return data.leaveType;
};

export const listHolidaysApi = async () => {
  const { data } = await api.get<{ holidays: Holiday[] }>("/org/holidays");
  return data.holidays;
};

export const createHolidayApi = async (payload: {
  name: string;
  date: string;
  description?: string;
}) => {
  const { data } = await api.post<{ holiday: Holiday }>("/org/holidays", payload);
  return data.holiday;
};

export const deleteHolidayApi = async (id: string) => {
  const { data } = await api.delete(`/org/holidays/${id}`);
  return data;
};

// ==================== M3: Employees ====================
export const listEmployeesApi = async (params?: {
  q?: string;
  departmentId?: string;
  status?: string;
  page?: number;
  limit?: number;
}) => {
  const { data } = await api.get<{
    employees: EmployeeRecord[];
    total: number;
    page: number;
    pages: number;
  }>("/employees", { params });
  return data;
};

export const registerEmployeeApi = async (payload: Record<string, unknown>) => {
  const { data } = await api.post<{
    message: string;
    employee: EmployeeRecord;
    credentials: { email: string; temporaryPassword: string; mustChangeOnFirstLogin: boolean };
  }>("/employees", payload);
  return data;
};

export const getEmployee360Api = async (id: string) => {
  const { data } = await api.get<{
    employee: EmployeeRecord;
    recentAttendance: Array<{
      _id: string;
      date: string;
      status: string;
      checkInAt?: string;
      checkOutAt?: string;
      workedHours?: number;
      source?: string;
    }>;
    leaveBalances: LeaveBalanceItem[];
    recentLeaves: Array<{
      _id: string;
      leaveTypeName: string;
      startDate: string;
      endDate: string;
      workingDays: number;
      status: string;
    }>;
    payslips: PayslipRecord[];
  }>(`/employees/${id}`);
  return data;
};

export const updateEmployeeApi = async (id: string, payload: Record<string, unknown>) => {
  const { data } = await api.put<{ message: string; employee: EmployeeRecord }>(
    `/employees/${id}`,
    payload
  );
  return data;
};

export const updateOwnContactApi = async (payload: { phone: string; address: string }) => {
  const { data } = await api.patch<{ message: string; employee: EmployeeRecord }>(
    "/employees/me/contact",
    payload
  );
  return data;
};

export const updateSalaryStructureApi = async (
  id: string,
  payload: { basic: number; hraPercent: number; medicalPercent: number; otherAllowances: number }
) => {
  const { data } = await api.put<{ message: string; salaryStructure: SalaryStructure }>(
    `/employees/${id}/salary`,
    payload
  );
  return data;
};

export const importEmployeesCsvApi = async (payload: {
  csvText: string;
  dryRun: boolean;
  defaultTemporaryPassword?: string;
}) => {
  const { data } = await api.post("/employees/import", payload);
  return data;
};

export const exportEmployeesCsvDownload = () =>
  downloadAuthenticatedBlob("/employees/export", "employees_export.csv");

// ==================== M4: Attendance ====================
export const checkInApi = async (payload?: Record<string, unknown>) => {
  const { data } = await api.post("/attendance/check-in", payload || { source: "web" });
  return data;
};

export const resetTodayAttendanceApi = async () => {
  const { data } = await api.post("/attendance/reset-today");
  return data;
};

export const checkOutApi = async () => {
  const { data } = await api.post("/attendance/check-out");
  return data;
};

export const getAttendanceCalendarApi = async (params?: {
  year?: number;
  month?: number;
  employeeId?: string;
}) => {
  const { data } = await api.get<{
    year: number;
    month: number;
    todayStr: string;
    todayRecord: {
      _id: string;
      date: string;
      checkInAt?: string;
      checkOutAt?: string;
      workedHours?: number;
      status: string;
      source: string;
    } | null;
    days: Array<{
      date: string;
      status: string;
      label?: string;
      isLate?: boolean;
      lateMinutes?: number;
      checkInAt?: string;
      checkOutAt?: string;
      workedHours?: number;
      source?: string;
    }>;
  }>("/attendance/calendar", { params });
  return data;
};

export const getDailyBoardApi = async (params?: { date?: string; departmentId?: string }) => {
  const { data } = await api.get<{
    date: string;
    counts: {
      total: number;
      present: number;
      late: number;
      halfDay: number;
      missingCheckout: number;
      onLeave: number;
      absent: number;
    };
    board: Array<{
      employeeId: string;
      employeeCode: string;
      fullName: string;
      departmentName: string;
      designationTitle: string;
      date: string;
      status: string;
      isLate: boolean;
      lateMinutes: number;
      checkInAt: string | null;
      checkOutAt: string | null;
      workedHours: number;
      source: string | null;
      distanceMeters: number | null;
      leaveType: string | null;
    }>;
  }>("/attendance/board", { params });
  return data;
};

export const requestCorrectionApi = async (payload: {
  date: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
}) => {
  const { data } = await api.post("/attendance/corrections", payload);
  return data;
};

export const listCorrectionsApi = async (status?: string) => {
  const { data } = await api.get<{
    corrections: Array<{
      _id: string;
      date: string;
      requestedCheckIn: string;
      requestedCheckOut: string;
      reason: string;
      status: "pending" | "approved" | "rejected";
      reviewComment?: string;
      createdAt: string;
      userId?: { name: string; email: string };
      employeeId?: { employeeCode: string; fullName: string };
      reviewedBy?: { name: string };
    }>;
  }>("/attendance/corrections", { params: status ? { status } : undefined });
  return data.corrections;
};

export const reviewCorrectionApi = async (
  id: string,
  payload: { decision: "approved" | "rejected"; comment?: string }
) => {
  const { data } = await api.patch(`/attendance/corrections/${id}/review`, payload);
  return data;
};

// ==================== M5: Leave ====================
export const getMyLeaveBalancesApi = async () => {
  const { data } = await api.get<{ balances: LeaveBalanceItem[] }>("/leaves/balances");
  return data.balances;
};

export const listLeavesApi = async (params?: { status?: string; mine?: string }) => {
  const { data } = await api.get<{
    leaves: Array<{
      _id: string;
      leaveTypeCode: string;
      leaveTypeName: string;
      startDate: string;
      endDate: string;
      workingDays: number;
      reason: string;
      source: string;
      status: "pending" | "approved" | "rejected" | "cancelled";
      reviewComment?: string;
      createdAt: string;
      userId?: { _id: string; name: string; email: string };
      employeeId?: {
        employeeCode: string;
        fullName: string;
        departmentId?: { name: string };
      };
      reviewedBy?: { name: string };
    }>;
  }>("/leaves", { params });
  return data.leaves;
};

export const applyLeaveApi = async (payload: {
  leaveTypeId?: string;
  leaveTypeCode?: string;
  startDate: string;
  endDate: string;
  reason: string;
  source?: "manual" | "smart_ai";
}) => {
  const { data } = await api.post("/leaves", payload);
  return data;
};

export const cancelLeaveApi = async (id: string) => {
  const { data } = await api.patch(`/leaves/${id}/cancel`);
  return data;
};

export const reviewLeaveApi = async (
  id: string,
  payload: { decision: "approved" | "rejected"; comment?: string }
) => {
  const { data } = await api.patch(`/leaves/${id}/review`, payload);
  return data;
};

// ==================== M6: Payroll ====================
export const listPayrollRunsApi = async () => {
  const { data } = await api.get<{
    runs: Array<{
      _id: string;
      month: number;
      year: number;
      status: "draft" | "finalized";
      workingDaysInMonth: number;
      totalEmployees: number;
      totalGross: number;
      totalDeductions: number;
      totalTax: number;
      totalNet: number;
      latePenaltyApplied: boolean;
      preparedBy?: { name: string };
      finalizedBy?: { name: string };
      finalizedAt?: string;
      updatedAt: string;
    }>;
  }>("/payroll/runs");
  return data.runs;
};

export const generatePayrollDraftApi = async (payload: { month: number; year: number }) => {
  const { data } = await api.post("/payroll/runs", payload);
  return data;
};

export const getPayrollRunByIdApi = async (id: string) => {
  const { data } = await api.get<{
    payrollRun: {
      _id: string;
      month: number;
      year: number;
      status: "draft" | "finalized";
      workingDaysInMonth: number;
      totalEmployees: number;
      totalGross: number;
      totalDeductions: number;
      totalTax: number;
      totalNet: number;
      latePenaltyApplied: boolean;
    };
    payslips: PayslipRecord[];
  }>(`/payroll/runs/${id}`);
  return data;
};

export const finalizePayrollRunApi = async (id: string) => {
  const { data } = await api.post(`/payroll/runs/${id}/finalize`);
  return data;
};

export const listPayslipsApi = async (params?: { month?: number; year?: number }) => {
  const { data } = await api.get<{ payslips: PayslipRecord[] }>("/payroll/payslips", { params });
  return data.payslips;
};

export const downloadPayslipPdf = (id: string, code = "EMP", year = 2026, month = 1) =>
  downloadAuthenticatedBlob(
    `/payroll/payslips/${id}/pdf`,
    `Payslip_${code}_${year}-${String(month).padStart(2, "0")}.pdf`
  );

export const downloadOfferLetterPdf = (employeeId: string, code = "EMP") =>
  downloadAuthenticatedBlob(
    `/employees/${employeeId}/offer-letter-pdf`,
    `Offer_Letter_${code}.pdf`
  );

export const downloadExperiencePdf = (employeeId: string, code = "EMP") =>
  downloadAuthenticatedBlob(
    `/employees/${employeeId}/experience-letter-pdf`,
    `Experience_Certificate_${code}.pdf`
  );

// ==================== M10: Performance & OKRs ====================
export interface OkrGoal {
  _id: string;
  title: string;
  description?: string;
  targetMetric?: string;
  progress: number;
  status: "in_progress" | "completed" | "delayed";
}

export interface PerformanceRecord {
  _id: string;
  employeeId: {
    _id: string;
    fullName: string;
    employeeCode: string;
    departmentId?: { name: string; code: string };
    designationId?: { title: string };
  };
  userId: { _id: string; name: string; email: string };
  period: string;
  goals: OkrGoal[];
  managerRating: number;
  managerFeedback: string;
  aiSummary: string;
  reviewedBy?: { name: string };
  reviewedAt?: string;
  updatedAt: string;
}

export const listPerformanceApi = async () => {
  const { data } = await api.get<{ records: PerformanceRecord[]; myRecord?: PerformanceRecord }>("/performance");
  return data;
};

export const addGoalApi = async (payload: { title: string; description?: string; targetMetric?: string; progress?: number; employeeId?: string }) => {
  const { data } = await api.post("/performance/goals", payload);
  return data;
};

export const updateGoalProgressApi = async (id: string, goalId: string, payload: { progress: number; status?: string }) => {
  const { data } = await api.patch(`/performance/${id}/goals/${goalId}`, payload);
  return data;
};

export const submitAppraisalApi = async (id: string, payload: { rating: number; feedback: string }) => {
  const { data } = await api.patch(`/performance/${id}/review`, payload);
  return data;
};

export const generateAiPerformanceReviewApi = async (id: string) => {
  const { data } = await api.post<{ message: string; aiSummary: string }>(`/performance/${id}/ai-review`);
  return data;
};

// ==================== M7: Dashboards ====================
export const getDashboardApi = async (params?: {
  startDate?: string;
  endDate?: string;
  departmentId?: string;
}) => {
  const cleanParams: Record<string, string> = {};
  if (params?.startDate) cleanParams.startDate = params.startDate;
  if (params?.endDate) cleanParams.endDate = params.endDate;
  if (params?.departmentId) cleanParams.departmentId = params.departmentId;
  const { data } = await api.get("/dashboard", { params: cleanParams });
  return data;
};

// ==================== M8: AI Assistant ====================
export const aiChatApi = async (
  message: string,
  history?: Array<{ role: "user" | "assistant"; text: string }>
) => {
  const { data } = await api.post<{
    answer: string;
    toolsCalled: string[];
    provider?: string;
    aiGenerated: boolean;
    fallbackUsed?: boolean;
  }>("/ai/chat", { message, history });
  return data;
};

export const aiSummarizeApi = async (kpiData: Record<string, unknown>, dashboardType: string) => {
  const { data } = await api.post<{
    bullets: string[];
    aiGenerated: boolean;
    provider?: string;
  }>("/ai/summarize", { kpiData, dashboardType });
  return data;
};

export const aiSmartLeaveApi = async (text: string) => {
  const { data } = await api.post<{
    suggestion: {
      type: string;
      start: string;
      end: string;
      reason: string;
      leaveTypeId: string | null;
      leaveTypeName: string;
      workingDays: number;
    };
    aiGenerated: boolean;
    provider?: string;
  }>("/ai/smart-leave", { text });
  return data;
};

// ==================== M9: Comms & Audit ====================
export const listAnnouncementsApi = async () => {
  const { data } = await api.get<{
    announcements: Array<{
      _id: string;
      title: string;
      body: string;
      priority: "normal" | "important" | "urgent";
      authorName: string;
      authorRole: string;
      departmentId?: { _id: string; name: string } | null;
      createdAt: string;
    }>;
  }>("/announcements");
  return data.announcements;
};

export const createAnnouncementApi = async (payload: {
  title: string;
  body: string;
  priority: string;
  departmentId?: string | null;
}) => {
  const { data } = await api.post("/announcements", payload);
  return data;
};

export const listNotificationsApi = async () => {
  const { data } = await api.get<{
    notifications: Array<{
      _id: string;
      title: string;
      message: string;
      type: string;
      isRead: boolean;
      link?: string;
      createdAt: string;
    }>;
    unreadCount: number;
  }>("/notifications");
  return data;
};

export const markNotificationReadApi = async (id: string) => {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data;
};

export const markAllNotificationsReadApi = async () => {
  const { data } = await api.patch("/notifications/read-all");
  return data;
};

export const listAuditLogsApi = async (params?: {
  action?: string;
  entityType?: string;
  page?: number;
}) => {
  const { data } = await api.get<{
    logs: Array<{
      _id: string;
      actorName: string;
      actorEmail: string;
      actorRole: string;
      action: string;
      entityType: string;
      summary: string;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
      createdAt: string;
    }>;
    total: number;
    page: number;
    pages: number;
  }>("/audit-logs", { params });
  return data;
};


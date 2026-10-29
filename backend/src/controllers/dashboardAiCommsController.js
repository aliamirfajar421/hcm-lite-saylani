import Employee from "../models/Employee.js";
import User from "../models/User.js";
import { Attendance, AttendanceCorrection } from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { Payslip } from "../models/Payroll.js";
import { Announcement, Notification, AuditLog } from "../models/CommsAudit.js";
import {
  getActiveSettings,
  computeHeadcountMetrics,
  computeAttendanceAnalytics,
  computeLeaveBalanceForUser,
  computeLeaveSummary,
  computePayrollAnalytics,
} from "../services/analyticsService.js";
import {
  handleAiChat,
  handleAiDashboardSummary,
  handleAiSmartLeave,
} from "../services/aiService.js";
import { getLocalDateTimeParts } from "../services/rulesService.js";
import { recordAudit, sendNotification } from "../services/auditService.js";

/**
 * #18 Role-Specific Server-Aggregated Dashboards with Date & Department Filters
 */
export const getDashboardData = async (req, res) => {
  try {
    const settings = await getActiveSettings();
    const { startDate = null, endDate = null, departmentId = null } = req.query;
    const { dateStr: todayStr } = getLocalDateTimeParts(new Date(), settings.timezone);

    const announcements = await Announcement.find(
      departmentId ? { $or: [{ departmentId: null }, { departmentId }] } : {}
    )
      .populate("departmentId", "name")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    if (req.user.role === "admin") {
      const [headcountData, payrollData, attendanceData, recentAudits] = await Promise.all([
        computeHeadcountMetrics({ departmentId, startDate, endDate }),
        computePayrollAnalytics({ departmentId }),
        computeAttendanceAnalytics({ startDate, endDate, departmentId }),
        AuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
      ]);

      return res.json({
        role: "admin",
        companyName: settings.companyName,
        currency: settings.currency || "PKR",
        filters: { startDate, endDate, departmentId },
        kpis: {
          headcount: headcountData.headcount,
          attritionRate: headcountData.attritionRate,
          exitsInPeriod: headcountData.exitsInPeriod,
          payrollCost: payrollData.hasPayrollRun ? payrollData.totalGross : headcountData.estimatedMonthlyGross,
          netPayrollCost: payrollData.totalNet,
          avgSalary: headcountData.avgSalary,
          attendanceRate: attendanceData.summary.attendanceRate,
          today: attendanceData.today,
        },
        headcountByDepartment: headcountData.byDepartment,
        payrollByDepartment: payrollData.byDepartment.length
          ? payrollData.byDepartment
          : headcountData.byDepartment.map((d) => ({
              departmentName: d.departmentName,
              count: d.count,
              totalGross: d.grossPayroll,
            })),
        genderBreakdown: headcountData.genderBreakdown,
        tenureBreakdown: headcountData.tenureBreakdown,
        attritionRisk: attendanceData.attritionRisk,
        anomalyFlags: attendanceData.anomalyFlags,
        auditFeed: recentAudits,
        announcements,
      });
    }

    if (req.user.role === "hr") {
      const [
        headcountData,
        attendanceData,
        leaveData,
        pendingLeaves,
        pendingCorrections,
        pendingLeaveList,
        todayAttendanceRoster,
      ] = await Promise.all([
        computeHeadcountMetrics({ departmentId, startDate, endDate }),
        computeAttendanceAnalytics({ startDate, endDate, departmentId }),
        computeLeaveSummary({ departmentId, startDate, endDate }),
        LeaveRequest.countDocuments({ status: "pending" }),
        AttendanceCorrection.countDocuments({ status: "pending" }),
        LeaveRequest.find({ status: "pending" })
          .populate("userId", "name email")
          .populate("leaveTypeId", "name code")
          .sort({ createdAt: -1 })
          .limit(6)
          .lean(),
        Attendance.find({ date: todayStr })
          .populate("userId", "name email")
          .sort({ checkInAt: -1 })
          .limit(10)
          .lean(),
      ]);

      return res.json({
        role: "hr",
        companyName: settings.companyName,
        currency: settings.currency || "PKR",
        filters: { startDate, endDate, departmentId },
        kpis: {
          headcount: headcountData.headcount,
          today: attendanceData.today,
          attendanceRate: attendanceData.summary.attendanceRate,
          latePercentage: attendanceData.summary.latePercentage,
          pendingApprovals: pendingLeaves + pendingCorrections,
          pendingLeaves,
          pendingCorrections,
        },
        attendanceTrend: attendanceData.trend,
        absenteeismByDepartment: attendanceData.byDepartment,
        leaveByType: leaveData.byType,
        onLeaveToday: leaveData.onLeaveToday,
        topLateComers: attendanceData.topLateComers,
        anomalyFlags: attendanceData.anomalyFlags,
        attritionRisk: attendanceData.attritionRisk,
        pendingLeaveList,
        todayAttendanceRoster,
        announcements,
      });
    }

    // Employee Self-Service Dashboard
    const nowDate = new Date(`${todayStr}T00:00:00Z`);
    const dayOfWeek = nowDate.getUTCDay();
    const diffToMon = (dayOfWeek + 6) % 7;
    const mondayDate = new Date(nowDate.getTime() - diffToMon * 86400000).toISOString().slice(0, 10);
    const monthStart = `${todayStr.slice(0, 7)}-01`;

    const [todayAttendance, weekRecords, monthRecords, leaveBalances, lastPayslip, empProfile] =
      await Promise.all([
        Attendance.findOne({ userId: req.user._id, date: todayStr }).lean(),
        Attendance.find({ userId: req.user._id, date: { $gte: mondayDate, $lte: todayStr } }).lean(),
        Attendance.find({ userId: req.user._id, date: { $gte: monthStart, $lte: todayStr } }).lean(),
        computeLeaveBalanceForUser(req.user._id),
        Payslip.findOne({ userId: req.user._id }).sort({ year: -1, month: -1 }).lean(),
        Employee.findOne({ userId: req.user._id })
          .populate("departmentId", "name")
          .populate("designationId", "title")
          .lean(),
      ]);

    const hoursThisWeek = Math.round(
      weekRecords.reduce((acc, r) => {
        if (r.workedHours) return acc + Number(r.workedHours);
        if (r.checkInAt && !r.checkOutAt && r.date === todayStr) {
          return acc + Math.max(0, (Date.now() - new Date(r.checkInAt).getTime()) / 3600000);
        }
        return acc;
      }, 0) * 100
    ) / 100;

    const lateCountThisMonth = monthRecords.filter((r) => r.isLate || r.status === "late").length;
    const totalLeaveRemaining = leaveBalances
      .filter((b) => !b.isUnlimited)
      .reduce((sum, b) => sum + Number(b.remaining || 0), 0);

    return res.json({
      role: "employee",
      companyName: settings.companyName,
      currency: settings.currency || "PKR",
      todayStr,
      officeHours: `${settings.officeStartTime} - ${settings.officeEndTime}`,
      officeLocation: settings.officeLocation,
      employee: empProfile,
      todayAttendance,
      kpis: {
        hoursThisWeek,
        weeklyTargetHours: 40,
        lateCountThisMonth,
        totalLeaveRemaining,
      },
      leaveBalances,
      lastPayslip,
      announcements,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #19 & #22 AI Assistant Chat (All roles, scoped, multi-turn history supported)
 */
export const aiChat = async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "Message is required" });
    }
    const result = await handleAiChat({
      message: String(message).trim(),
      history: Array.isArray(history) ? history : [],
      user: req.user,
    });
    if (result.rateLimited) {
      return res.status(429).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #20 AI Dashboard Summary (Admin & HR)
 */
export const aiSummarizeDashboard = async (req, res) => {
  try {
    const { kpiData, dashboardType = req.user.role } = req.body;
    if (!kpiData || typeof kpiData !== "object") {
      return res.status(400).json({ message: "kpiData JSON object is required" });
    }
    const result = await handleAiDashboardSummary({
      kpiData,
      dashboardType,
      user: req.user,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #21 Smart Leave Form Assistant (HR & Employee)
 */
export const aiSmartLeave = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: "Natural language leave text is required" });
    }
    const result = await handleAiSmartLeave({
      text: String(text).trim(),
      user: req.user,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #23 Announcements (Post: Admin & HR; Read: All)
 */
export const listAnnouncements = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "employee") {
      const emp = await Employee.findOne({ userId: req.user._id }).select("departmentId").lean();
      filter = emp?.departmentId
        ? { $or: [{ departmentId: null }, { departmentId: emp.departmentId }] }
        : { departmentId: null };
    }
    const announcements = await Announcement.find(filter)
      .populate("departmentId", "name code")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ announcements });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createAnnouncement = async (req, res) => {
  try {
    const { title, body, priority = "normal", departmentId = null } = req.body;
    if (!title || !body) {
      return res.status(400).json({ message: "Announcement title and body are required" });
    }

    const ann = await Announcement.create({
      title: String(title).trim(),
      body: String(body).trim(),
      priority: ["normal", "important", "urgent"].includes(priority) ? priority : "normal",
      departmentId: departmentId || null,
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
    });

    // Notify target users in-app
    let targetUserIds = [];
    if (departmentId) {
      const deptEmps = await Employee.find({ departmentId, employmentStatus: { $ne: "exited" } })
        .select("userId")
        .lean();
      targetUserIds = deptEmps.map((e) => e.userId);
    } else {
      const activeUsers = await User.find({ isActive: true, _id: { $ne: req.user._id } })
        .select("_id")
        .lean();
      targetUserIds = activeUsers.map((u) => u._id);
    }

    await Promise.all(
      targetUserIds.map((uid) =>
        sendNotification({
          userId: uid,
          title: `Announcement: ${ann.title}`,
          message: ann.body.slice(0, 140),
          type: "announcement",
          link: "/announcements",
        })
      )
    );

    await recordAudit({
      actor: req.user,
      action: "ANNOUNCEMENT_POSTED",
      entityType: "Announcement",
      entityId: ann._id,
      summary: `Posted announcement '${ann.title}' (${ann.priority})`,
      after: { title: ann.title, priority: ann.priority },
    });

    res.status(201).json({ message: "Announcement published", announcement: ann });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #24 In-App Notifications (Own)
 */
export const listNotifications = async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(30).lean(),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { isRead: true } }
    );
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { $set: { isRead: true } });
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #25 Audit Log (Admin ONLY — Immutable, read-only)
 */
export const listAuditLogs = async (req, res) => {
  try {
    const { action = "", entityType = "", page = 1, limit = 40 } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 40));

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    res.json({
      logs,
      total,
      page: pageNum,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


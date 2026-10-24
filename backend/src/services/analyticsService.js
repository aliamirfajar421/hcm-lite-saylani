import Employee from "../models/Employee.js";
import { CompanySettings, Department, Designation, LeaveType, Holiday } from "../models/Organization.js";
import { Attendance, AttendanceCorrection } from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { PayrollRun, Payslip } from "../models/Payroll.js";
import { Announcement, AuditLog } from "../models/CommsAudit.js";
import { getLocalDateTimeParts, getWorkingDatesInRange, getMonthDateBounds } from "./rulesService.js";

export async function getActiveSettings() {
  const settings = await CompanySettings.findOne();
  return (
    settings || {
      companyName: "HCM Lite",
      currency: "PKR",
      timezone: process.env.TIMEZONE || "Asia/Karachi",
      officeStartTime: "09:00",
      officeEndTime: "18:00",
      graceMinutes: 15,
      halfDayHours: 5,
      weekendDays: [0, 6],
      officeLocation: { lat: 24.8607, lng: 67.0011, address: "Head Office", radiusMeters: 150 },
      latePenaltyEnabled: true,
    }
  );
}

/**
 * Shared Tool / Service: Headcount & Attrition
 */
export async function computeHeadcountMetrics({ departmentId = null, startDate = null, endDate = null } = {}) {
  const settings = await getActiveSettings();
  const { dateStr: todayStr } = getLocalDateTimeParts(new Date(), settings.timezone);
  const yearStart = `${todayStr.slice(0, 4)}-01-01`;
  const rangeStart = startDate || yearStart;
  const rangeEnd = endDate || todayStr;

  const empFilter = {};
  if (departmentId) empFilter.departmentId = departmentId;

  const [employees, departments] = await Promise.all([
    Employee.find(empFilter).populate("departmentId", "name code").populate("designationId", "title").lean(),
    Department.find({ isActive: true }).lean(),
  ]);

  const activeEmployees = employees.filter(
    (e) =>
      (e.employmentStatus === "active" || e.employmentStatus === "probation") &&
      (!e.joiningDate || e.joiningDate <= rangeEnd)
  );

  const activeAtStart = employees.filter(
    (e) =>
      e.joiningDate <= rangeStart &&
      (!e.exitDate || e.exitDate > rangeStart)
  ).length;

  const exitsInPeriod = employees.filter(
    (e) =>
      e.employmentStatus === "exited" &&
      e.exitDate &&
      e.exitDate >= rangeStart &&
      e.exitDate <= rangeEnd
  ).length;

  const headcount = activeEmployees.length;
  const avgHeadcount = (activeAtStart + headcount) / 2;
  const attritionRate =
    avgHeadcount > 0 ? Math.round((exitsInPeriod / avgHeadcount) * 10000) / 100 : 0;

  const deptMap = new Map();
  departments.forEach((d) => {
    deptMap.set(String(d._id), {
      departmentId: String(d._id),
      departmentName: d.name,
      code: d.code,
      count: 0,
      grossPayroll: 0,
    });
  });

  const genderBreakdown = { male: 0, female: 0, other: 0 };
  const tenureBreakdown = { under1Yr: 0, oneToThreeYrs: 0, overThreeYrs: 0 };
  let totalMonthlyGross = 0;

  for (const emp of activeEmployees) {
    const dId = emp.departmentId?._id ? String(emp.departmentId._id) : String(emp.departmentId);
    const dName = emp.departmentId?.name || "Unassigned";
    if (!deptMap.has(dId)) {
      deptMap.set(dId, { departmentId: dId, departmentName: dName, code: "", count: 0, grossPayroll: 0 });
    }
    const bucket = deptMap.get(dId);
    bucket.count += 1;
    const gross = Number(emp.salaryStructure?.gross || 0);
    bucket.grossPayroll = Math.round((bucket.grossPayroll + gross) * 100) / 100;
    totalMonthlyGross += gross;

    const g = emp.gender || "male";
    genderBreakdown[g] = (genderBreakdown[g] || 0) + 1;

    const joinMs = new Date(`${emp.joiningDate}T00:00:00Z`).getTime();
    const endMs = new Date(`${rangeEnd}T00:00:00Z`).getTime();
    const years = Math.max(0, (endMs - joinMs) / (365.25 * 86400000));
    if (years < 1) tenureBreakdown.under1Yr += 1;
    else if (years <= 3) tenureBreakdown.oneToThreeYrs += 1;
    else tenureBreakdown.overThreeYrs += 1;
  }

  const avgSalary = headcount > 0 ? Math.round((totalMonthlyGross / headcount) * 100) / 100 : 0;

  return {
    headcount,
    activeCount: activeEmployees.filter((e) => e.employmentStatus === "active").length,
    probationCount: activeEmployees.filter((e) => e.employmentStatus === "probation").length,
    exitsInPeriod,
    attritionRate,
    avgSalary,
    estimatedMonthlyGross: Math.round(totalMonthlyGross * 100) / 100,
    byDepartment: Array.from(deptMap.values()).filter((d) => !departmentId || d.departmentId === String(departmentId)),
    genderBreakdown,
    tenureBreakdown,
  };
}

/**
 * Shared Tool / Service: Attendance Summary, Trend, Late-Comers & Anomalies
 */
export async function computeAttendanceAnalytics({
  startDate = null,
  endDate = null,
  departmentId = null,
  scopedUserId = null, // When set, restricts strictly to a single user (Employee self-scope)
} = {}) {
  const settings = await getActiveSettings();
  const { dateStr: todayStr } = getLocalDateTimeParts(new Date(), settings.timezone);
  const currentMonthStart = `${todayStr.slice(0, 7)}-01`;
  const rangeStart = startDate || currentMonthStart;
  const rangeEnd = endDate && endDate <= todayStr ? endDate : todayStr < rangeStart ? rangeStart : endDate || todayStr;
  const effectiveEnd = rangeEnd > todayStr ? todayStr : rangeEnd;

  const empQuery = { employmentStatus: { $in: ["active", "probation"] } };
  if (departmentId) empQuery.departmentId = departmentId;
  if (scopedUserId) empQuery.userId = scopedUserId;

  const [employees, holidays, attendances, approvedLeaves] = await Promise.all([
    Employee.find(empQuery).populate("departmentId", "name code").lean(),
    Holiday.find({ date: { $gte: rangeStart, $lte: rangeEnd } }).lean(),
    Attendance.find({
      ...(scopedUserId ? { userId: scopedUserId } : {}),
      date: { $gte: rangeStart, $lte: rangeEnd },
    }).lean(),
    LeaveRequest.find({
      ...(scopedUserId ? { userId: scopedUserId } : {}),
      status: "approved",
      startDate: { $lte: rangeEnd },
      endDate: { $gte: rangeStart },
    }).lean(),
  ]);

  const empIds = new Set(employees.map((e) => String(e._id)));
  const empByUserId = new Map(employees.map((e) => [String(e.userId), e]));
  const holidaySet = new Set(holidays.map((h) => h.date));
  const workingDates = getWorkingDatesInRange(rangeStart, effectiveEnd, settings.weekendDays, holidaySet);

  // Filter attendance & leaves to matching employees (when dept filtered)
  const scopedAttendances = departmentId
    ? attendances.filter((a) => (a.employeeId && empIds.has(String(a.employeeId))) || empByUserId.has(String(a.userId)))
    : scopedUserId
      ? attendances
      : attendances.filter((a) => !a.employeeId || empIds.has(String(a.employeeId)) || empByUserId.has(String(a.userId)));

  const attMap = new Map();
  for (const a of scopedAttendances) {
    attMap.set(`${String(a.userId)}_${a.date}`, a);
  }

  const leaveMap = new Map(); // userId_date -> leave
  for (const lr of approvedLeaves) {
    if (departmentId && !empByUserId.has(String(lr.userId))) continue;
    for (const d of lr.dates || []) {
      if (d >= rangeStart && d <= rangeEnd) {
        leaveMap.set(`${String(lr.userId)}_${d}`, lr);
      }
    }
  }

  let presentCount = 0;
  let lateCount = 0;
  let halfDayCount = 0;
  let missingCheckoutCount = 0;
  let onLeaveCount = 0;
  let absentCount = 0;
  let workingDayRecords = 0;

  const trendByDate = new Map();
  workingDates.forEach((d) => {
    trendByDate.set(d, { date: d, present: 0, late: 0, halfDay: 0, onLeave: 0, absent: 0 });
  });

  const deptStats = new Map();
  const lateComerMap = new Map();
  const anomalyFlags = [];
  const attritionRiskList = [];

  for (const emp of employees) {
    const uid = String(emp.userId);
    const deptName = emp.departmentId?.name || "Unassigned";
    const dId = emp.departmentId?._id ? String(emp.departmentId._id) : "unassigned";
    if (!deptStats.has(dId)) {
      deptStats.set(dId, {
        departmentId: dId,
        departmentName: deptName,
        expectedDays: 0,
        present: 0,
        late: 0,
        absent: 0,
        onLeave: 0,
        absenteeismRate: 0,
        lateRate: 0,
      });
    }
    const ds = deptStats.get(dId);

    let empLates = 0;
    let empAbsents = 0;
    let empMonFriAbsents = 0;
    let empMissingCheckouts = 0;

    for (const d of workingDates) {
      if (emp.joiningDate && d < emp.joiningDate) continue;
      if (emp.exitDate && d > emp.exitDate) continue;

      workingDayRecords += 1;
      ds.expectedDays += 1;
      const dayBucket = trendByDate.get(d);
      const key = `${uid}_${d}`;
      const att = attMap.get(key);
      const lv = leaveMap.get(key);

      if (lv) {
        onLeaveCount += 1;
        ds.onLeave += 1;
        if (dayBucket) dayBucket.onLeave += 1;
      } else if (att) {
        const effectiveStatus =
          !att.checkOutAt && d < todayStr && att.status !== "absent" && att.status !== "on_leave"
            ? "missing_checkout"
            : att.status;

        if (att.isLate || effectiveStatus === "late") {
          empLates += 1;
        }
        if (effectiveStatus === "missing_checkout") {
          missingCheckoutCount += 1;
          empMissingCheckouts += 1;
          if (att.isLate) ds.late += 1;
          else ds.present += 1;
          if (dayBucket) dayBucket.present += 1;
        } else if (effectiveStatus === "half_day") {
          halfDayCount += 1;
          ds.present += 0.5;
          if (dayBucket) dayBucket.halfDay += 1;
        } else if (effectiveStatus === "late") {
          lateCount += 1;
          ds.late += 1;
          if (dayBucket) dayBucket.late += 1;
        } else if (effectiveStatus === "present") {
          presentCount += 1;
          ds.present += 1;
          if (dayBucket) dayBucket.present += 1;
        } else if (effectiveStatus === "absent") {
          absentCount += 1;
          empAbsents += 1;
          ds.absent += 1;
          if (dayBucket) dayBucket.absent += 1;
        }
      } else if (d <= todayStr) {
        // Don't mark today as absent until day ends unless desired; wait: on daily stats, count unrecorded past days & today's unrecorded
        absentCount += 1;
        empAbsents += 1;
        ds.absent += 1;
        if (dayBucket) dayBucket.absent += 1;
        const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
        if (dow === 1 || dow === 5) empMonFriAbsents += 1;
      }
    }

    if (empLates > 0) {
      lateComerMap.set(String(emp._id), {
        employeeId: String(emp._id),
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        departmentName: deptName,
        lateCount: empLates,
      });
    }

    // Bonus: Absence Anomaly Detection & Attrition Risk Score
    if (!scopedUserId) {
      if (empMonFriAbsents >= 2) {
        anomalyFlags.push({
          employeeId: String(emp._id),
          employeeCode: emp.employeeCode,
          fullName: emp.fullName,
          departmentName: deptName,
          type: "Monday/Friday Absence Pattern",
          detail: `${empMonFriAbsents} unapproved absences on Mondays/Fridays`,
        });
      } else if (empMissingCheckouts >= 2) {
        anomalyFlags.push({
          employeeId: String(emp._id),
          employeeCode: emp.employeeCode,
          fullName: emp.fullName,
          departmentName: deptName,
          type: "Repeated Missing Check-outs",
          detail: `${empMissingCheckouts} days without check-out`,
        });
      } else if (empAbsents >= 3) {
        anomalyFlags.push({
          employeeId: String(emp._id),
          employeeCode: emp.employeeCode,
          fullName: emp.fullName,
          departmentName: deptName,
          type: "High Unexcused Absences",
          detail: `${empAbsents} absent working days in period`,
        });
      }

      const riskScore = Math.min(100, empAbsents * 15 + empLates * 10 + empMissingCheckouts * 8);
      if (riskScore >= 25) {
        attritionRiskList.push({
          employeeId: String(emp._id),
          employeeCode: emp.employeeCode,
          fullName: emp.fullName,
          departmentName: deptName,
          riskScore,
          riskLevel: riskScore >= 60 ? "High" : "Medium",
          factors: `Lates: ${empLates}, Absences: ${empAbsents}`,
        });
      }
    }
  }

  // Exact Section 7 Formula:
  // Attendance rate = (present + late + missing_checkout + 0.5 * half_day) / (working-day records - on_leave)
  const denominator = workingDayRecords - onLeaveCount;
  const attendedUnits = presentCount + lateCount + missingCheckoutCount + 0.5 * halfDayCount;
  const attendanceRate =
    denominator > 0 ? Math.min(100, Math.round((attendedUnits / denominator) * 10000) / 100) : 0;

  const totalAttendedPresentLate = presentCount + lateCount;
  const latePercentage =
    totalAttendedPresentLate > 0
      ? Math.round((lateCount / totalAttendedPresentLate) * 10000) / 100
      : 0;

  for (const ds of deptStats.values()) {
    ds.absenteeismRate =
      ds.expectedDays > 0 ? Math.round((ds.absent / ds.expectedDays) * 10000) / 100 : 0;
    const pl = ds.present + ds.late;
    ds.lateRate = pl > 0 ? Math.round((ds.late / pl) * 10000) / 100 : 0;
  }

  // Today's snapshot
  const todayAttendances = scopedAttendances.filter((a) => a.date === todayStr);
  const todayPresent = todayAttendances.filter((a) => a.status !== "absent" && a.status !== "on_leave").length;
  const todayLate = todayAttendances.filter((a) => a.isLate || a.status === "late").length;
  const todayOnLeave = employees.filter((e) => leaveMap.has(`${String(e.userId)}_${todayStr}`)).length;

  const topLateComers = Array.from(lateComerMap.values())
    .sort((a, b) => b.lateCount - a.lateCount)
    .slice(0, 5);

  return {
    rangeStart,
    rangeEnd: effectiveEnd,
    todayStr,
    today: {
      headcount: employees.length,
      present: todayPresent,
      late: todayLate,
      onLeave: todayOnLeave,
      absent: Math.max(0, employees.length - todayPresent - todayOnLeave),
    },
    summary: {
      workingDayRecords,
      present: presentCount,
      late: lateCount,
      halfDay: halfDayCount,
      missingCheckout: missingCheckoutCount,
      onLeave: onLeaveCount,
      absent: absentCount,
      attendanceRate,
      latePercentage,
    },
    trend: Array.from(trendByDate.values()),
    byDepartment: Array.from(deptStats.values()),
    topLateComers,
    anomalyFlags: anomalyFlags.slice(0, 8),
    attritionRisk: attritionRiskList.sort((a, b) => b.riskScore - a.riskScore).slice(0, 8),
  };
}

/**
 * Shared Tool / Service: Leave Utilization & Balance
 */
export async function computeLeaveBalanceForUser(userId, year = null) {
  const settings = await getActiveSettings();
  const { dateStr: todayStr } = getLocalDateTimeParts(new Date(), settings.timezone);
  const targetYear = String(year || todayStr.slice(0, 4));
  const yearStart = `${targetYear}-01-01`;
  const yearEnd = `${targetYear}-12-31`;

  const [leaveTypes, requests] = await Promise.all([
    LeaveType.find({ isActive: true }).sort({ name: 1 }).lean(),
    LeaveRequest.find({
      userId,
      status: { $in: ["approved", "pending"] },
      startDate: { $lte: yearEnd },
      endDate: { $gte: yearStart },
    }).lean(),
  ]);

  return leaveTypes.map((lt) => {
    const approvedDays = requests
      .filter((r) => String(r.leaveTypeId) === String(lt._id) && r.status === "approved")
      .reduce((acc, r) => acc + Number(r.workingDays || 0), 0);

    const pendingDays = requests
      .filter((r) => String(r.leaveTypeId) === String(lt._id) && r.status === "pending")
      .reduce((acc, r) => acc + Number(r.workingDays || 0), 0);

    const quota = lt.isUnlimited ? null : Number(lt.yearlyQuota || 0);
    const remaining = lt.isUnlimited ? null : Math.max(0, quota - approvedDays);

    return {
      leaveTypeId: String(lt._id),
      code: lt.code,
      name: lt.name,
      isPaid: lt.isPaid,
      isUnlimited: lt.isUnlimited,
      quota,
      approvedDays,
      pendingDays,
      remaining,
    };
  });
}

export async function computeLeaveSummary({ departmentId = null, startDate = null, endDate = null } = {}) {
  const settings = await getActiveSettings();
  const { dateStr: todayStr } = getLocalDateTimeParts(new Date(), settings.timezone);
  const yearStart = `${todayStr.slice(0, 4)}-01-01`;
  const rangeStart = startDate || yearStart;
  const rangeEnd = endDate || `${todayStr.slice(0, 4)}-12-31`;

  const empQuery = { employmentStatus: { $in: ["active", "probation"] } };
  if (departmentId) empQuery.departmentId = departmentId;

  const [employees, leaveTypes, leaves] = await Promise.all([
    Employee.find(empQuery).populate("departmentId", "name").lean(),
    LeaveType.find({ isActive: true }).lean(),
    LeaveRequest.find({
      startDate: { $lte: rangeEnd },
      endDate: { $gte: rangeStart },
    })
      .populate("employeeId", "fullName employeeCode departmentId")
      .lean(),
  ]);

  const empUserSet = new Set(employees.map((e) => String(e.userId)));
  const scopedLeaves = departmentId
    ? leaves.filter((l) => empUserSet.has(String(l.userId)))
    : leaves;

  const onLeaveToday = scopedLeaves
    .filter((l) => l.status === "approved" && l.startDate <= todayStr && l.endDate >= todayStr)
    .map((l) => ({
      employeeName: l.employeeId?.fullName || "Staff",
      employeeCode: l.employeeId?.employeeCode || "",
      leaveType: l.leaveTypeName || l.leaveTypeCode,
      startDate: l.startDate,
      endDate: l.endDate,
      reason: l.reason,
    }));

  const headcount = Math.max(1, employees.length);
  const byType = leaveTypes.map((lt) => {
    const approvedDays = scopedLeaves
      .filter((l) => l.status === "approved" && l.leaveTypeCode === lt.code)
      .reduce((sum, l) => sum + Number(l.workingDays || 0), 0);
    const totalQuota = lt.isUnlimited ? null : Number(lt.yearlyQuota || 0) * headcount;
    const utilizationRate =
      totalQuota && totalQuota > 0
        ? Math.round((approvedDays / totalQuota) * 10000) / 100
        : 0;
    return {
      code: lt.code,
      name: lt.name,
      approvedDays,
      totalQuota,
      utilizationRate,
    };
  });

  return {
    todayStr,
    onLeaveTodayCount: onLeaveToday.length,
    onLeaveToday,
    pendingCount: scopedLeaves.filter((l) => l.status === "pending").length,
    approvedCount: scopedLeaves.filter((l) => l.status === "approved").length,
    byType,
  };
}

/**
 * Shared Tool / Service: Payroll Analytics
 */
export async function computePayrollAnalytics({ month = null, year = null, departmentId = null } = {}) {
  const settings = await getActiveSettings();
  const { dateStr: todayStr } = getLocalDateTimeParts(new Date(), settings.timezone);
  const targetYear = Number(year || todayStr.slice(0, 4));
  const targetMonth = Number(month || todayStr.slice(5, 7));

  const run = await PayrollRun.findOne({ month: targetMonth, year: targetYear }).lean();
  const latestRun = run || (await PayrollRun.findOne().sort({ year: -1, month: -1 }).lean());

  if (!latestRun) {
    return {
      hasPayrollRun: false,
      month: targetMonth,
      year: targetYear,
      status: null,
      totalGross: 0,
      totalNet: 0,
      totalTax: 0,
      totalDeductions: 0,
      avgGross: 0,
      byDepartment: [],
    };
  }

  const slipQuery = { payrollRunId: latestRun._id };
  if (departmentId) {
    slipQuery["employeeSnapshot.departmentId"] = departmentId;
  }

  const slips = await Payslip.find(slipQuery).lean();
  let totalGross = 0;
  let totalNet = 0;
  let totalTax = 0;
  let totalDeductions = 0;
  const deptMap = new Map();

  for (const s of slips) {
    totalGross += Number(s.proratedGross || 0);
    totalNet += Number(s.netPay || 0);
    totalTax += Number(s.monthlyTax || 0);
    totalDeductions += Number(s.attendanceDeduction || 0);

    const dName = s.employeeSnapshot?.departmentName || "General";
    if (!deptMap.has(dName)) {
      deptMap.set(dName, { departmentName: dName, count: 0, totalGross: 0, totalNet: 0, avgGross: 0 });
    }
    const b = deptMap.get(dName);
    b.count += 1;
    b.totalGross = Math.round((b.totalGross + Number(s.proratedGross || 0)) * 100) / 100;
    b.totalNet = Math.round((b.totalNet + Number(s.netPay || 0)) * 100) / 100;
  }

  for (const b of deptMap.values()) {
    b.avgGross = b.count > 0 ? Math.round((b.totalGross / b.count) * 100) / 100 : 0;
  }

  const round2 = (n) => Math.round(n * 100) / 100;

  return {
    hasPayrollRun: true,
    payrollRunId: String(latestRun._id),
    month: latestRun.month,
    year: latestRun.year,
    status: latestRun.status,
    employeeCount: slips.length,
    totalGross: round2(totalGross),
    totalNet: round2(totalNet),
    totalTax: round2(totalTax),
    totalDeductions: round2(totalDeductions),
    avgGross: slips.length > 0 ? round2(totalGross / slips.length) : 0,
    byDepartment: Array.from(deptMap.values()),
  };
}


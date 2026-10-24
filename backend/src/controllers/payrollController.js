import Employee from "../models/Employee.js";
import { Holiday } from "../models/Organization.js";
import { Attendance } from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { PayrollRun, Payslip } from "../models/Payroll.js";
import { getActiveSettings } from "../services/analyticsService.js";
import {
  getLocalDateTimeParts,
  getMonthDateBounds,
  getWorkingDatesInRange,
  computeEmployeePayslip,
} from "../services/rulesService.js";
import { generatePayslipPdfBuffer } from "../services/pdfService.js";
import { recordAudit, sendNotification } from "../services/auditService.js";

/**
 * #15 HR Creates / Recalculates Monthly Payroll Draft
 * Cannot modify a finalized run!
 */
export const generatePayrollDraft = async (req, res) => {
  try {
    const settings = await getActiveSettings();
    const { dateStr: todayStr } = getLocalDateTimeParts(new Date(), settings.timezone);

    const month = Number(req.body.month || todayStr.slice(5, 7));
    const year = Number(req.body.year || todayStr.slice(0, 4));

    if (!month || month < 1 || month > 12 || !year || year < 2000) {
      return res.status(400).json({ message: "Valid month (1-12) and year are required" });
    }

    let run = await PayrollRun.findOne({ month, year });
    if (run && run.status === "finalized") {
      return res.status(403).json({
        message: "This monthly payroll run has been finalized by Admin and is permanently locked.",
      });
    }

    const { startDate, endDate } = getMonthDateBounds(year, month);
    const [holidays, employees, attendances, approvedLeaves] = await Promise.all([
      Holiday.find({ date: { $gte: startDate, $lte: endDate } }).lean(),
      Employee.find({
        joiningDate: { $lte: endDate },
        $or: [{ exitDate: null }, { exitDate: { $gte: startDate } }],
      })
        .populate("departmentId", "name code")
        .populate("designationId", "title")
        .lean(),
      Attendance.find({ date: { $gte: startDate, $lte: endDate } }).lean(),
      LeaveRequest.find({
        status: "approved",
        startDate: { $lte: endDate },
        endDate: { $gte: startDate },
      })
        .populate("leaveTypeId", "isPaid")
        .lean(),
    ]);

    if (employees.length === 0) {
      return res.status(422).json({
        message: "No active employees found for the selected payroll period.",
      });
    }

    const holidaySet = new Set(holidays.map((h) => h.date));
    const monthWorkingDates = getWorkingDatesInRange(
      startDate,
      endDate,
      settings.weekendDays,
      holidaySet
    );

    if (!run) {
      run = await PayrollRun.create({
        month,
        year,
        status: "draft",
        workingDaysInMonth: Math.max(1, monthWorkingDates.length),
        latePenaltyApplied: Boolean(settings.latePenaltyEnabled),
        preparedBy: req.user._id,
      });
    } else {
      run.workingDaysInMonth = Math.max(1, monthWorkingDates.length);
      run.latePenaltyApplied = Boolean(settings.latePenaltyEnabled);
      run.preparedBy = req.user._id;
    }

    const attByUser = new Map();
    for (const a of attendances) {
      const uid = String(a.userId);
      if (!attByUser.has(uid)) attByUser.set(uid, new Map());
      attByUser.get(uid).set(a.date, a);
    }

    const paidLeaveByUser = new Map();
    const unpaidLeaveByUser = new Map();
    for (const lr of approvedLeaves) {
      const uid = String(lr.userId);
      const isUnpaid = lr.leaveTypeCode === "unpaid" || lr.leaveTypeId?.isPaid === false;
      const targetMap = isUnpaid ? unpaidLeaveByUser : paidLeaveByUser;
      if (!targetMap.has(uid)) targetMap.set(uid, new Set());
      for (const d of lr.dates || []) {
        if (d >= startDate && d <= endDate) targetMap.get(uid).add(d);
      }
    }

    await Payslip.deleteMany({ payrollRunId: run._id });

    let totalGross = 0;
    let totalDeductions = 0;
    let totalTax = 0;
    let totalNet = 0;
    const slipsToInsert = [];

    for (const emp of employees) {
      const uid = String(emp.userId);
      const calc = computeEmployeePayslip({
        employee: emp,
        month,
        year,
        monthWorkingDates,
        attendanceByDate: attByUser.get(uid) || new Map(),
        paidLeaveDateSet: paidLeaveByUser.get(uid) || new Set(),
        unpaidLeaveDateSet: unpaidLeaveByUser.get(uid) || new Set(),
        latePenaltyEnabled: Boolean(settings.latePenaltyEnabled),
        todayStr,
      });

      totalGross += calc.proratedGross;
      totalDeductions += calc.attendanceDeduction;
      totalTax += calc.monthlyTax;
      totalNet += calc.netPay;

      slipsToInsert.push({
        payrollRunId: run._id,
        employeeId: emp._id,
        userId: emp.userId,
        month,
        year,
        employeeSnapshot: {
          employeeCode: emp.employeeCode,
          fullName: emp.fullName,
          email: emp.email,
          departmentId: emp.departmentId?._id || null,
          departmentName: emp.departmentId?.name || "General",
          designationTitle: emp.designationId?.title || "Staff",
          joiningDate: emp.joiningDate,
        },
        ...calc,
        status: "draft",
      });
    }

    const createdSlips = await Payslip.insertMany(slipsToInsert);
    const round2 = (n) => Math.round(n * 100) / 100;

    run.totalEmployees = createdSlips.length;
    run.totalGross = round2(totalGross);
    run.totalDeductions = round2(totalDeductions);
    run.totalTax = round2(totalTax);
    run.totalNet = round2(totalNet);
    await run.save();

    await recordAudit({
      actor: req.user,
      action: "PAYROLL_DRAFT_GENERATED",
      entityType: "PayrollRun",
      entityId: run._id,
      summary: `Prepared payroll draft for ${month}/${year} (${run.totalEmployees} employees, Net: ${run.totalNet})`,
      after: {
        month,
        year,
        totalEmployees: run.totalEmployees,
        totalGross: run.totalGross,
        totalNet: run.totalNet,
      },
    });

    res.status(201).json({
      message: `Payroll draft generated for ${month}/${year}`,
      payrollRun: run,
      payslips: createdSlips,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const listPayrollRuns = async (_req, res) => {
  try {
    const runs = await PayrollRun.find()
      .populate("preparedBy", "name email")
      .populate("finalizedBy", "name email")
      .sort({ year: -1, month: -1 })
      .lean();
    res.json({ runs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getPayrollRunById = async (req, res) => {
  try {
    const run = await PayrollRun.findById(req.params.id)
      .populate("preparedBy", "name email")
      .populate("finalizedBy", "name email")
      .lean();
    if (!run) return res.status(404).json({ message: "Payroll run not found" });

    const payslips = await Payslip.find({ payrollRunId: run._id })
      .sort({ "employeeSnapshot.employeeCode": 1 })
      .lean();

    res.json({ payrollRun: run, payslips });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #16 Admin Finalizes Monthly Payroll (Permanently locks the month!)
 */
export const finalizePayrollRun = async (req, res) => {
  try {
    const run = await PayrollRun.findById(req.params.id);
    if (!run) return res.status(404).json({ message: "Payroll run not found" });
    if (run.status === "finalized") {
      return res.status(409).json({ message: "Payroll run is already finalized and locked" });
    }

    const before = { status: run.status };
    run.status = "finalized";
    run.finalizedBy = req.user._id;
    run.finalizedAt = new Date();
    await run.save();

    await Payslip.updateMany({ payrollRunId: run._id }, { $set: { status: "finalized" } });
    const slips = await Payslip.find({ payrollRunId: run._id }).select("userId netPay month year").lean();

    await Promise.all(
      slips.map((s) =>
        sendNotification({
          userId: s.userId,
          title: `Payslip Ready (${s.month}/${s.year})`,
          message: `Your monthly salary payslip for ${s.month}/${s.year} has been finalized and is ready for PDF download.`,
          type: "payroll",
          link: "/payroll",
        })
      )
    );

    await recordAudit({
      actor: req.user,
      action: "PAYROLL_FINALIZED",
      entityType: "PayrollRun",
      entityId: run._id,
      summary: `Finalized & locked payroll for ${run.month}/${run.year} (${run.totalEmployees} payslips)`,
      before,
      after: { status: "finalized", totalNet: run.totalNet },
    });

    res.json({
      message: `Payroll for ${run.month}/${run.year} finalized and locked!`,
      payrollRun: run,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #17 List Payslips (Admin/HR: All, Employee: Strictly Own Only!)
 */
export const listPayslips = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "employee") {
      filter.userId = req.user._id;
    } else {
      if (req.query.month) filter.month = Number(req.query.month);
      if (req.query.year) filter.year = Number(req.query.year);
      if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    }

    const payslips = await Payslip.find(filter)
      .sort({ year: -1, month: -1, "employeeSnapshot.employeeCode": 1 })
      .lean();

    res.json({ payslips });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #17 Download Payslip PDF (Strict Scope Check: Employee can ONLY download own payslip)
 */
export const downloadPayslipPdf = async (req, res) => {
  try {
    const slip = await Payslip.findById(req.params.id).lean();
    if (!slip) return res.status(404).json({ message: "Payslip not found" });

    if (req.user.role === "employee" && String(slip.userId) !== req.user.userId) {
      return res.status(403).json({
        message: "Access denied: You can only download your own payslips",
      });
    }

    const settings = await getActiveSettings();
    const pdfBuffer = generatePayslipPdfBuffer(
      slip,
      settings.companyName || "HCM Lite",
      settings.currency || "PKR"
    );

    const code = slip.employeeSnapshot?.employeeCode || "EMP";
    const filename = `Payslip_${code}_${slip.year}-${String(slip.month).padStart(2, "0")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


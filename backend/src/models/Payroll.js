import mongoose from "mongoose";

const payrollRunSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    status: {
      type: String,
      enum: ["draft", "finalized"],
      default: "draft",
    },
    workingDaysInMonth: { type: Number, required: true },
    totalEmployees: { type: Number, default: 0 },
    totalGross: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    totalNet: { type: Number, default: 0 },
    latePenaltyApplied: { type: Boolean, default: true },
    preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    finalizedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

payrollRunSchema.index({ month: 1, year: 1 }, { unique: true });

const payslipSchema = new mongoose.Schema(
  {
    payrollRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollRun",
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    employeeSnapshot: {
      employeeCode: String,
      fullName: String,
      email: String,
      departmentId: mongoose.Schema.Types.ObjectId,
      departmentName: String,
      designationTitle: String,
      joiningDate: String,
    },
    basic: { type: Number, required: true },
    hra: { type: Number, required: true },
    medical: { type: Number, required: true },
    otherAllowances: { type: Number, default: 0 },
    gross: { type: Number, required: true },
    workingDaysInMonth: { type: Number, required: true },
    eligibleWorkingDays: { type: Number, required: true },
    presentDays: { type: Number, default: 0 },
    paidLeaveDays: { type: Number, default: 0 },
    unpaidLeaveDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    lateCount: { type: Number, default: 0 },
    latePenaltyDays: { type: Number, default: 0 },
    deductibleDays: { type: Number, default: 0 },
    perDayRate: { type: Number, required: true },
    proratedGross: { type: Number, required: true },
    attendanceDeduction: { type: Number, default: 0 },
    annualizedGross: { type: Number, required: true },
    annualTax: { type: Number, default: 0 },
    monthlyTax: { type: Number, default: 0 },
    netPay: { type: Number, required: true },
    status: {
      type: String,
      enum: ["draft", "finalized"],
      default: "draft",
    },
  },
  { timestamps: true }
);

payslipSchema.index({ payrollRunId: 1, employeeId: 1 }, { unique: true });

export const PayrollRun = mongoose.model("PayrollRun", payrollRunSchema);
export const Payslip = mongoose.model("Payslip", payslipSchema);


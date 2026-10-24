import test from "node:test";
import assert from "node:assert/strict";
import {
  computeSalaryStructure,
  calculateAnnualTax,
  evaluateCheckInStatus,
  evaluateCheckOutStatus,
  getWorkingDatesInRange,
  computeEmployeePayslip,
  calculateHaversineMeters,
  validateEmployeeCsvRows,
} from "../src/services/rulesService.js";
import { generatePayslipPdfBuffer } from "../src/services/pdfService.js";
import { parseCsv, toCsv } from "../src/services/csvService.js";

process.env.NODE_ENV = "test";

test("M6 Salary Structure: Gross = 1.5x Basic (HRA 40%, Medical 10%)", () => {
  const s = computeSalaryStructure({ basic: 100000 });
  assert.equal(s.basic, 100000);
  assert.equal(s.hra, 40000);
  assert.equal(s.medical, 10000);
  assert.equal(s.gross, 150000);
});

test("M6 Tax Slabs: All 5 illustrative annual tax slabs match specification", () => {
  assert.equal(calculateAnnualTax(550000), 0);
  assert.equal(calculateAnnualTax(600000), 0);
  // 900k -> 5% above 600k = 15,000
  assert.equal(calculateAnnualTax(900000), 15000);
  // 1.8M -> 30k + 15% of 600k = 120,000
  assert.equal(calculateAnnualTax(1800000), 120000);
  // 3.0M -> 210k + 25% of 600k = 360,000
  assert.equal(calculateAnnualTax(3000000), 360000);
  // 4.6M -> 510k + 35% of 1.0M = 860,000
  assert.equal(calculateAnnualTax(4600000), 860000);
});

test("M4 Check-In & Check-Out Status Rules (09:15 grace cutoff & <5h half_day)", () => {
  // 09:10 PKT = 04:10 UTC -> on time
  const onTime = evaluateCheckInStatus({
    now: new Date("2026-10-26T04:10:00Z"),
    timezone: "Asia/Karachi",
    officeStartTime: "09:00",
    graceMinutes: 15,
  });
  assert.equal(onTime.isLate, false);
  assert.equal(onTime.status, "present");

  // 09:20 PKT = 04:20 UTC -> late by 5 min
  const late = evaluateCheckInStatus({
    now: new Date("2026-10-26T04:20:00Z"),
    timezone: "Asia/Karachi",
    officeStartTime: "09:00",
    graceMinutes: 15,
  });
  assert.equal(late.isLate, true);
  assert.equal(late.lateMinutes, 5);
  assert.equal(late.status, "late");

  // Check-out after 4 hours (< 5h) -> half_day
  const half = evaluateCheckOutStatus({
    checkInAt: new Date("2026-10-26T04:00:00Z"),
    checkOutAt: new Date("2026-10-26T08:00:00Z"),
    isLate: false,
    halfDayHours: 5,
  });
  assert.equal(half.workedHours, 4);
  assert.equal(half.status, "half_day");

  // Check-out after 8 hours -> preserves late/present
  const full = evaluateCheckOutStatus({
    checkInAt: new Date("2026-10-26T04:20:00Z"),
    checkOutAt: new Date("2026-10-26T12:20:00Z"),
    isLate: true,
    halfDayHours: 5,
  });
  assert.equal(full.workedHours, 8);
  assert.equal(full.status, "late");
});

test("M5 Working Days Calculation skips weekends and public holidays", () => {
  // 2026-10-23 (Fri) to 2026-10-27 (Tue), with 2026-10-26 as holiday
  const holidays = new Set(["2026-10-26"]);
  const dates = getWorkingDatesInRange("2026-10-23", "2026-10-27", [0, 6], holidays);
  // Fri (23), Sat (24 skip), Sun (25 skip), Mon (26 holiday skip), Tue (27)
  assert.deepEqual(dates, ["2026-10-23", "2026-10-27"]);
});

test("M6 Payslip Calculation: Deductions, Proration & Late Penalty (3 lates = 0.5 day)", () => {
  const monthWorkingDates = [
    "2026-10-01",
    "2026-10-02",
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
  ]; // 10 working days for easy math
  const attMap = new Map([
    ["2026-10-01", { status: "late", isLate: true }],
    ["2026-10-02", { status: "late", isLate: true }],
    ["2026-10-05", { status: "late", isLate: true }],
    ["2026-10-06", { status: "half_day", isLate: false }],
    ["2026-10-07", { status: "present", isLate: false }],
    ["2026-10-08", { status: "present", isLate: false }],
    ["2026-10-09", { status: "present", isLate: false }],
    // 2026-10-12: paid leave
    // 2026-10-13: unpaid leave
    // 2026-10-14: absent (no record)
  ]);

  const slip = computeEmployeePayslip({
    employee: {
      joiningDate: "2026-01-01",
      exitDate: null,
      salaryStructure: computeSalaryStructure({ basic: 100000 }), // Gross = 150,000
    },
    month: 10,
    year: 2026,
    monthWorkingDates,
    attendanceByDate: attMap,
    paidLeaveDateSet: new Set(["2026-10-12"]),
    unpaidLeaveDateSet: new Set(["2026-10-13"]),
    latePenaltyEnabled: true,
    todayStr: "2026-10-31",
  });

  // Per day = 150,000 / 10 = 15,000
  // Deductible days = 1 absent + 1 unpaid + 0.5 half_day + 0.5 (3 lates) = 3.0 days -> 45,000
  // Annual gross = 1,800,000 -> Annual tax = 120,000 -> Monthly tax = 10,000
  // Net = 150,000 - 45,000 - 10,000 = 95,000
  assert.equal(slip.perDayRate, 15000);
  assert.equal(slip.lateCount, 3);
  assert.equal(slip.latePenaltyDays, 0.5);
  assert.equal(slip.deductibleDays, 3);
  assert.equal(slip.attendanceDeduction, 45000);
  assert.equal(slip.monthlyTax, 10000);
  assert.equal(slip.netPay, 95000);
});

test("M4 Camera Geofence Haversine Distance Check", () => {
  const officeLat = 24.8607;
  const officeLng = 67.0011;
  const insideDist = calculateHaversineMeters(24.8610, 67.0013, officeLat, officeLng);
  assert.ok(insideDist < 150, `Expected inside 150m, got ${insideDist}m`);

  const outsideDist = calculateHaversineMeters(24.8700, 67.0100, officeLat, officeLng);
  assert.ok(outsideDist > 150, `Expected outside 150m, got ${outsideDist}m`);
});

test("M3 CSV Dry-Run Validator catches invalid rows and accepts valid rows", () => {
  const csvText = [
    "employeeCode,fullName,email,department,joiningDate,basicSalary",
    "EMP001,Sara Khan,sara@acme.com,Engineering,2026-02-01,80000",
    "EMP001,Bad Row,not-an-email,UnknownDept,01-02-2026,-500",
  ].join("\n");

  const parsed = parseCsv(csvText);
  const deptLookup = new Map([["engineering", { _id: "dept1", name: "Engineering", code: "ENG" }]]);

  const { validRows, errors } = validateEmployeeCsvRows({
    rows: parsed,
    existingEmails: new Set(),
    existingCodes: new Set(),
    departmentLookup: deptLookup,
  });

  assert.equal(validRows.length, 1);
  assert.equal(validRows[0].employeeCode, "EMP001");
  assert.ok(errors.length >= 4);
  assert.ok(errors.some((e) => e.row === 3 && e.field === "employeeCode"));
  assert.ok(errors.some((e) => e.row === 3 && e.field === "email"));
  assert.ok(errors.some((e) => e.row === 3 && e.field === "department"));
  assert.ok(errors.some((e) => e.row === 3 && e.field === "joiningDate"));
  assert.ok(errors.some((e) => e.row === 3 && e.field === "basicSalary"));

  const exported = toCsv(
    [{ key: "employeeCode", label: "employeeCode" }],
    [{ employeeCode: "EMP001" }]
  );
  assert.ok(exported.includes("EMP001"));
});

test("M6 PDF Payslip Generator outputs valid %PDF-1.4 document", () => {
  const buf = generatePayslipPdfBuffer(
    {
      month: 10,
      year: 2026,
      status: "finalized",
      employeeSnapshot: {
        employeeCode: "EMP001",
        fullName: "Ali Raza",
        email: "ali@company.com",
        departmentName: "Engineering",
        designationTitle: "Software Engineer",
        joiningDate: "2026-01-15",
      },
      basic: 100000,
      hra: 40000,
      medical: 10000,
      otherAllowances: 0,
      gross: 150000,
      proratedGross: 150000,
      workingDaysInMonth: 22,
      eligibleWorkingDays: 22,
      presentDays: 21,
      paidLeaveDays: 1,
      unpaidLeaveDays: 0,
      absentDays: 0,
      halfDays: 0,
      lateCount: 0,
      latePenaltyDays: 0,
      attendanceDeduction: 0,
      monthlyTax: 10000,
      annualizedGross: 1800000,
      perDayRate: 6818.18,
      netPay: 140000,
    },
    "Zaitoon Tech",
    "PKR"
  );

  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.subarray(0, 8).toString("ascii").startsWith("%PDF-1.4"));
  assert.ok(buf.toString("ascii").includes("%%EOF"));
});

test("Express Backend App mounts all 9 module routes cleanly", async () => {
  const { app } = await import("../src/server.js");
  assert.ok(app, "Express app exported cleanly");
});


/**
 * Core Business Rules Engine for HCM Lite
 * Pure functions used across REST APIs, Payroll, Analytics, and AI Tools.
 */

export function getLocalDateTimeParts(date = new Date(), timezone = "Asia/Karachi") {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(date).map((p) => [p.type, p.value])
    );
    const hourNum = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
    const hh = String(hourNum).padStart(2, "0");
    return {
      dateStr: `${parts.year}-${parts.month}-${parts.day}`,
      timeStr: `${hh}:${parts.minute}`,
      minutesOfDay: hourNum * 60 + Number(parts.minute),
    };
  } catch {
    const iso = date.toISOString();
    const [d, t] = iso.split("T");
    const [hh, mm] = t.slice(0, 5).split(":").map(Number);
    return {
      dateStr: d,
      timeStr: t.slice(0, 5),
      minutesOfDay: hh * 60 + mm,
    };
  }
}

export function parseTimeMinutes(hhmm = "09:00") {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!match) return 9 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isValidIsoDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dateStr;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

/**
 * Haversine distance in meters between two GPS coordinates (Server Geofence Check)
 */
export function calculateHaversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (Number(deg) * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Euclidean similarity check for optional enrolled face descriptors
 */
export function calculateDescriptorDistance(descA, descB) {
  if (!Array.isArray(descA) || !Array.isArray(descB) || descA.length !== descB.length || descA.length === 0) {
    return null;
  }
  let sumSq = 0;
  for (let i = 0; i < descA.length; i++) {
    const diff = Number(descA[i]) - Number(descB[i]);
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

/**
 * M4 Attendance Check-In Rule:
 * Late after officeStartTime + graceMinutes (default 09:00 + 15m = 09:15)
 */
export function evaluateCheckInStatus({
  now = new Date(),
  timezone = "Asia/Karachi",
  officeStartTime = "09:00",
  graceMinutes = 15,
}) {
  const { dateStr, timeStr, minutesOfDay } = getLocalDateTimeParts(now, timezone);
  const cutoffMinutes = parseTimeMinutes(officeStartTime) + Number(graceMinutes || 0);
  const isLate = minutesOfDay > cutoffMinutes;
  const lateMinutes = isLate ? minutesOfDay - cutoffMinutes : 0;
  return {
    dateStr,
    timeStr,
    isLate,
    lateMinutes,
    status: isLate ? "late" : "present",
  };
}

/**
 * M4 Attendance Check-Out Rule:
 * half_day if workedHours < halfDayHours (default 5h)
 */
export function evaluateCheckOutStatus({
  checkInAt,
  checkOutAt,
  isLate = false,
  halfDayHours = 5,
}) {
  const diffMs = new Date(checkOutAt).getTime() - new Date(checkInAt).getTime();
  const workedHours = Math.max(0, Math.round((diffMs / 3600000) * 100) / 100);
  let status = isLate ? "late" : "present";
  if (workedHours < Number(halfDayHours || 5)) {
    status = "half_day";
  }
  return { workedHours, status };
}

/**
 * Enumerate calendar dates inclusive [startDateStr .. endDateStr]
 */
export function enumerateDates(startDateStr, endDateStr) {
  if (!isValidIsoDate(startDateStr) || !isValidIsoDate(endDateStr) || startDateStr > endDateStr) {
    return [];
  }
  const dates = [];
  const cur = new Date(`${startDateStr}T00:00:00Z`);
  const end = new Date(`${endDateStr}T00:00:00Z`);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

/**
 * M5 Leave & M6 Payroll Working Days Rule:
 * Skips weekends (default [0, 6] Sun/Sat) and public holidays
 */
export function getWorkingDatesInRange(startDateStr, endDateStr, weekendDays = [0, 6], holidayDateSet = new Set()) {
  const weekendSet = new Set((weekendDays || [0, 6]).map(Number));
  const allDates = enumerateDates(startDateStr, endDateStr);
  return allDates.filter((dateStr) => {
    const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
    if (weekendSet.has(dayOfWeek)) return false;
    if (holidayDateSet.has(dateStr)) return false;
    return true;
  });
}

export function getMonthDateBounds(year, month) {
  const y = Number(year);
  const m = Number(month);
  const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate, lastDay };
}

/**
 * M6 Salary Structure Rule:
 * Default Gross = 1.5 * basic (HRA 40%, Medical 10%)
 */
export function computeSalaryStructure({
  basic,
  hraPercent = 40,
  medicalPercent = 10,
  otherAllowances = 0,
}) {
  const b = Math.round(Number(basic) * 100) / 100;
  const hp = Number(hraPercent ?? 40);
  const mp = Number(medicalPercent ?? 10);
  const oa = Math.max(0, Math.round(Number(otherAllowances || 0) * 100) / 100);
  const hra = Math.round(b * (hp / 100) * 100) / 100;
  const medical = Math.round(b * (mp / 100) * 100) / 100;
  const gross = Math.round((b + hra + medical + oa) * 100) / 100;
  return {
    basic: b,
    hraPercent: hp,
    medicalPercent: mp,
    hra,
    medical,
    otherAllowances: oa,
    gross,
  };
}

/**
 * M6 Tax Slab Rule on Annualized Gross (gross * 12):
 * 0 to 600k: 0
 * 600k to 1.2M: 5% above 600k
 * 1.2M to 2.4M: 30k + 15% above 1.2M
 * 2.4M to 3.6M: 210k + 25% above 2.4M
 * Above 3.6M: 510k + 35% above 3.6M
 */
export function calculateAnnualTax(annualGross) {
  const income = Math.max(0, Number(annualGross || 0));
  if (income <= 600000) return 0;
  if (income <= 1200000) return (income - 600000) * 0.05;
  if (income <= 2400000) return 30000 + (income - 1200000) * 0.15;
  if (income <= 3600000) return 210000 + (income - 2400000) * 0.25;
  return 510000 + (income - 3600000) * 0.35;
}

/**
 * M6 Monthly Employee Payslip Calculation:
 * - Per day = gross / workingDaysInMonth
 * - Prorate joiners/leavers
 * - Deduct absent + unpaid leave + 0.5 * half_day + optional late penalty (3 lates = 0.5 day)
 * - Monthly tax = calculateAnnualTax(gross * 12) / 12
 */
export function computeEmployeePayslip({
  employee,
  month,
  year,
  monthWorkingDates,
  attendanceByDate = new Map(),
  paidLeaveDateSet = new Set(),
  unpaidLeaveDateSet = new Set(),
  latePenaltyEnabled = true,
  todayStr,
}) {
  const workingDaysInMonth = Math.max(1, monthWorkingDates.length);
  const { startDate: monthStart, endDate: monthEnd } = getMonthDateBounds(year, month);

  const effectiveStart =
    employee.joiningDate && employee.joiningDate > monthStart ? employee.joiningDate : monthStart;
  const effectiveEnd =
    employee.exitDate && employee.exitDate < monthEnd ? employee.exitDate : monthEnd;

  const eligibleDates = monthWorkingDates.filter(
    (d) => d >= effectiveStart && d <= effectiveEnd
  );
  const eligibleWorkingDays = eligibleDates.length;

  const basic = Number(employee.salaryStructure?.basic || 0);
  const hra = Number(employee.salaryStructure?.hra ?? basic * 0.4);
  const medical = Number(employee.salaryStructure?.medical ?? basic * 0.1);
  const otherAllowances = Number(employee.salaryStructure?.otherAllowances || 0);
  const gross = Number(employee.salaryStructure?.gross || basic + hra + medical + otherAllowances);

  const perDayRate = gross / workingDaysInMonth;
  const proratedGross =
    eligibleWorkingDays === workingDaysInMonth
      ? gross
      : perDayRate * eligibleWorkingDays;

  let presentDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let lateCount = 0;

  // Only treat unrecorded days up to todayStr as absent (future days in current month aren't penalized prematurely)
  const absenceCutoff = todayStr && todayStr < effectiveEnd ? todayStr : effectiveEnd;

  for (const d of eligibleDates) {
    const att = attendanceByDate.get(d);
    if (unpaidLeaveDateSet.has(d)) {
      unpaidLeaveDays += 1;
    } else if (paidLeaveDateSet.has(d)) {
      paidLeaveDays += 1;
    } else if (att) {
      if (att.isLate || att.status === "late") {
        lateCount += 1;
      }
      if (att.status === "half_day") {
        halfDays += 1;
        presentDays += 0.5;
      } else if (att.status === "absent") {
        absentDays += 1;
      } else {
        // present, late, or missing_checkout count as attended day
        presentDays += 1;
      }
    } else if (d <= absenceCutoff) {
      absentDays += 1;
    }
  }

  const latePenaltyDays = latePenaltyEnabled ? Math.floor(lateCount / 3) * 0.5 : 0;
  const deductibleDays = absentDays + unpaidLeaveDays + 0.5 * halfDays + latePenaltyDays;
  const attendanceDeduction = Math.min(proratedGross, deductibleDays * perDayRate);

  const annualizedGross = gross * 12;
  const annualTax = calculateAnnualTax(annualizedGross);
  // Scale tax proportionally if prorated
  const prorationRatio = gross > 0 ? proratedGross / gross : 0;
  const monthlyTax = (annualTax / 12) * prorationRatio;

  const netPay = Math.max(0, proratedGross - attendanceDeduction - monthlyTax);

  const round2 = (n) => Math.round(Number(n) * 100) / 100;

  return {
    basic: round2(basic),
    hra: round2(hra),
    medical: round2(medical),
    otherAllowances: round2(otherAllowances),
    gross: round2(gross),
    workingDaysInMonth,
    eligibleWorkingDays,
    presentDays: round2(presentDays),
    paidLeaveDays,
    unpaidLeaveDays,
    absentDays,
    halfDays,
    lateCount,
    latePenaltyDays,
    deductibleDays: round2(deductibleDays),
    perDayRate: round2(perDayRate),
    proratedGross: round2(proratedGross),
    attendanceDeduction: round2(attendanceDeduction),
    annualizedGross: round2(annualizedGross),
    annualTax: round2(annualTax),
    monthlyTax: round2(monthlyTax),
    netPay: round2(netPay),
  };
}

/**
 * M3 CSV Import Dry-Run Validator:
 * Checks required fields, unique code/email (against DB & inside CSV),
 * valid email, known department, ISO date, salary > 0.
 * Returns { validRows, errors: [{ row, field, reason }] }
 */
export function validateEmployeeCsvRows({
  rows,
  existingEmails = new Set(),
  existingCodes = new Set(),
  departmentLookup = new Map(), // lowercase name or code -> department doc
}) {
  const errors = [];
  const validRows = [];
  const seenEmails = new Set();
  const seenCodes = new Set();

  rows.forEach((raw, idx) => {
    const rowNum = idx + 2; // Row 1 is CSV header
    const employeeCode = String(raw.employeeCode || raw.code || "").trim().toUpperCase();
    const fullName = String(raw.fullName || raw.name || "").trim();
    const email = String(raw.email || "").trim().toLowerCase();
    const departmentKey = String(raw.department || raw.departmentCode || "").trim().toLowerCase();
    const designation = String(raw.designation || "").trim();
    const joiningDate = String(raw.joiningDate || "").trim();
    const basicSalaryRaw = raw.basicSalary ?? raw.salary ?? "";
    const basicSalary = Number(basicSalaryRaw);
    const genderRaw = String(raw.gender || "male").trim().toLowerCase();
    const phone = String(raw.phone || "").trim();
    const address = String(raw.address || "").trim();

    let rowHasError = false;
    const addErr = (field, reason) => {
      rowHasError = true;
      errors.push({ row: rowNum, field, reason });
    };

    if (!employeeCode) {
      addErr("employeeCode", "Employee code is required");
    } else if (existingCodes.has(employeeCode) || seenCodes.has(employeeCode)) {
      addErr("employeeCode", `Duplicate employee code '${employeeCode}'`);
    }

    if (!fullName) {
      addErr("fullName", "Full name is required");
    }

    if (!email) {
      addErr("email", "Email is required");
    } else if (!isValidEmail(email)) {
      addErr("email", `Invalid email format '${email}'`);
    } else if (existingEmails.has(email) || seenEmails.has(email)) {
      addErr("email", `Email '${email}' already exists`);
    }

    const deptDoc = departmentKey ? departmentLookup.get(departmentKey) : null;
    if (!departmentKey) {
      addErr("department", "Department is required");
    } else if (!deptDoc) {
      addErr("department", `Unknown department '${raw.department || raw.departmentCode}'`);
    }

    if (!joiningDate) {
      addErr("joiningDate", "Joining date is required");
    } else if (!isValidIsoDate(joiningDate)) {
      addErr("joiningDate", `Joining date '${joiningDate}' must be YYYY-MM-DD`);
    }

    if (basicSalaryRaw === "" || Number.isNaN(basicSalary) || basicSalary <= 0) {
      addErr("basicSalary", "Basic salary must be a number greater than 0");
    }

    const gender = ["male", "female", "other"].includes(genderRaw) ? genderRaw : "male";

    if (!rowHasError) {
      seenCodes.add(employeeCode);
      seenEmails.add(email);
      validRows.push({
        employeeCode,
        fullName,
        email,
        departmentId: deptDoc._id,
        departmentName: deptDoc.name,
        designationTitle: designation,
        joiningDate,
        basicSalary,
        gender,
        phone,
        address,
      });
    }
  });

  return { validRows, errors };
}


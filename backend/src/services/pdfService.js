/**
 * Zero-dependency Valid PDF 1.4 Generator for Official Payslips
 * Produces crisp vector boxes, lines, and Helvetica typography with zero native binary dependencies.
 */

function escapePdfText(str) {
  return String(str ?? "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function fmtMoney(amount, currency = "PKR") {
  const num = Number(amount || 0);
  return `${currency} ${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function generatePayslipPdfBuffer(payslip, companyName = "HCM Lite Organization", currency = "PKR") {
  const ops = [];

  const rect = (x, y, w, h, r, g, b, fill = true) => {
    ops.push(`${r} ${g} ${b} ${fill ? "rg" : "RG"}`);
    ops.push(`${x} ${y} ${w} ${h} re ${fill ? "f" : "S"}`);
  };

  const line = (x1, y1, x2, y2, r = 0.85, g = 0.87, b = 0.9) => {
    ops.push(`${r} ${g} ${b} RG 0.8 w`);
    ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  };

  const text = (x, y, str, size = 10, bold = false, r = 0.1, g = 0.12, b = 0.16) => {
    const font = bold ? "/F2" : "/F1";
    ops.push(`BT ${font} ${size} Tf ${r} ${g} ${b} rg ${x} ${y} Td (${escapePdfText(str)}) Tj ET`);
  };

  const monthLabel = `${MONTH_NAMES[(payslip.month || 1) - 1] || "Month"} ${payslip.year}`;
  const snap = payslip.employeeSnapshot || {};

  // Header Banner
  rect(40, 735, 515, 68, 0.06, 0.25, 0.22, true);
  text(58, 776, companyName, 18, true, 1, 1, 1);
  text(58, 754, `OFFICIAL SALARY PAYSLIP  |  ${monthLabel.toUpperCase()}`, 10, false, 0.82, 0.95, 0.9);
  text(430, 776, payslip.status === "finalized" ? "STATUS: FINALIZED" : "STATUS: DRAFT", 10, true, 0.98, 0.85, 0.35);
  text(430, 754, `Code: ${snap.employeeCode || "N/A"}`, 9, false, 0.9, 0.95, 0.95);

  // Employee Details Card
  rect(40, 635, 515, 86, 0.97, 0.98, 0.99, true);
  rect(40, 635, 515, 86, 0.82, 0.86, 0.9, false);

  text(56, 701, "Employee Name:", 9, true, 0.35, 0.4, 0.48);
  text(145, 701, snap.fullName || "Employee", 10, true);
  text(320, 701, "Department:", 9, true, 0.35, 0.4, 0.48);
  text(405, 701, snap.departmentName || "General", 10, false);

  text(56, 680, "Email Address:", 9, true, 0.35, 0.4, 0.48);
  text(145, 680, snap.email || "-", 9, false);
  text(320, 680, "Designation:", 9, true, 0.35, 0.4, 0.48);
  text(405, 680, snap.designationTitle || "Staff", 9, false);

  text(56, 659, "Joining Date:", 9, true, 0.35, 0.4, 0.48);
  text(145, 659, snap.joiningDate || "-", 9, false);
  text(320, 659, "Working Days:", 9, true, 0.35, 0.4, 0.48);
  text(405, 659, `${payslip.eligibleWorkingDays} / ${payslip.workingDaysInMonth} days`, 9, false);

  // Attendance Summary Strip
  rect(40, 592, 515, 32, 0.93, 0.96, 0.95, true);
  text(
    56,
    604,
    `Attendance Summary:  Present: ${payslip.presentDays}  |  Paid Leave: ${payslip.paidLeaveDays}  |  Unpaid Leave: ${payslip.unpaidLeaveDays}  |  Absent: ${payslip.absentDays}  |  Half Days: ${payslip.halfDays}  |  Lates: ${payslip.lateCount}`,
    8.5,
    true,
    0.1,
    0.32,
    0.26
  );

  // Earnings & Deductions Columns Header
  rect(40, 550, 250, 26, 0.12, 0.16, 0.22, true);
  text(54, 559, "EARNINGS", 10, true, 1, 1, 1);
  text(210, 559, "AMOUNT", 10, true, 1, 1, 1);

  rect(305, 550, 250, 26, 0.12, 0.16, 0.22, true);
  text(319, 559, "DEDUCTIONS & TAX", 10, true, 1, 1, 1);
  text(475, 559, "AMOUNT", 10, true, 1, 1, 1);

  const earningsRows = [
    ["Basic Salary", fmtMoney(payslip.basic, currency)],
    ["House Rent Allowance (HRA)", fmtMoney(payslip.hra, currency)],
    ["Medical Allowance", fmtMoney(payslip.medical, currency)],
    ["Other Allowances", fmtMoney(payslip.otherAllowances || 0, currency)],
    ["Monthly Gross Structure", fmtMoney(payslip.gross, currency)],
    ["Prorated Gross Earned", fmtMoney(payslip.proratedGross, currency)],
  ];

  const deductionRows = [
    ["Absent & Unpaid Days", `${payslip.absentDays + payslip.unpaidLeaveDays} days`],
    ["Half-Day Deductions", `${payslip.halfDays * 0.5} days`],
    ["Late Penalty Days", `${payslip.latePenaltyDays || 0} days`],
    ["Attendance Deduction", fmtMoney(payslip.attendanceDeduction, currency)],
    ["Monthly Income Tax", fmtMoney(payslip.monthlyTax, currency)],
    ["Total Deductions", fmtMoney((payslip.attendanceDeduction || 0) + (payslip.monthlyTax || 0), currency)],
  ];

  let yPos = 528;
  for (let i = 0; i < earningsRows.length; i++) {
    const isTotal = i === earningsRows.length - 1;
    if (isTotal) {
      rect(40, yPos - 7, 250, 24, 0.94, 0.96, 0.98, true);
      rect(305, yPos - 7, 250, 24, 0.98, 0.94, 0.94, true);
    }
    text(54, yPos, earningsRows[i][0], 9.5, isTotal);
    text(185, yPos, earningsRows[i][1], 9.5, isTotal);

    text(319, yPos, deductionRows[i][0], 9.5, isTotal);
    text(450, yPos, deductionRows[i][1], 9.5, isTotal);

    line(40, yPos - 8, 290, yPos - 8);
    line(305, yPos - 8, 555, yPos - 8);
    yPos -= 26;
  }

  // Net Pay Highlight Box
  rect(40, 315, 515, 54, 0.06, 0.25, 0.22, true);
  text(58, 344, "NET PAYABLE SALARY", 13, true, 1, 1, 1);
  text(58, 327, `Annualized Gross: ${fmtMoney(payslip.annualizedGross, currency)}  |  Per-Day Rate: ${fmtMoney(payslip.perDayRate, currency)}`, 8.5, false, 0.8, 0.93, 0.9);
  text(375, 336, fmtMoney(payslip.netPay, currency), 16, true, 0.55, 0.98, 0.78);

  // Footer
  line(40, 275, 555, 275);
  text(40, 255, "System-generated official payslip from HCM Lite Human Capital Management.", 8.5, false, 0.45, 0.5, 0.56);
  text(40, 240, `Generated on ${new Date().toISOString().slice(0, 10)} | Saylani Hackathon 2026`, 8, false, 0.55, 0.6, 0.65);

  const streamContent = ops.join("\n");
  const streamBytes = Buffer.byteLength(streamContent, "ascii");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
    `6 0 obj\n<< /Length ${streamBytes} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += obj;
  }

  const xrefStart = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}


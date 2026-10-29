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

export function generateOfferLetterPdfBuffer(employee, companyName = "Saylani Tech HCM Lite", currency = "PKR") {
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

  // Corporate Header
  rect(40, 735, 515, 68, 0.08, 0.22, 0.35, true);
  text(58, 776, companyName, 18, true, 1, 1, 1);
  text(58, 754, "OFFICIAL EMPLOYMENT OFFER & APPOINTMENT LETTER", 10, false, 0.82, 0.95, 0.9);
  text(430, 776, "REF: HR-OFFER-2026", 9, true, 0.9, 0.95, 0.95);
  text(430, 754, `Date: ${new Date().toISOString().slice(0, 10)}`, 9, false, 0.85, 0.9, 0.95);

  // Recipient Box
  rect(40, 640, 515, 75, 0.96, 0.98, 1, true);
  rect(40, 640, 515, 75, 0.75, 0.82, 0.9, false);

  text(56, 695, "Candidate Name:", 9, true, 0.35, 0.4, 0.48);
  text(150, 695, employee.fullName || "Candidate", 10, true);
  text(56, 675, "Employee ID:", 9, true, 0.35, 0.4, 0.48);
  text(150, 675, employee.employeeCode || "EMP-NEW", 10, false);
  text(320, 695, "Designation:", 9, true, 0.35, 0.4, 0.48);
  text(400, 695, employee.designationId?.title || "Software Engineer", 10, true);
  text(320, 675, "Department:", 9, true, 0.35, 0.4, 0.48);
  text(400, 675, employee.departmentId?.name || "Engineering", 10, false);

  // Letter Body
  let y = 600;
  text(40, y, `Dear ${employee.fullName || "Team Member"},`, 11, true);
  y -= 25;
  text(40, y, `On behalf of ${companyName}, we are pleased to offer you the position of`, 10, false);
  y -= 18;
  text(40, y, `${employee.designationId?.title || "Professional"} in our ${employee.departmentId?.name || "Corporate"} division starting on ${employee.joiningDate || "immediate effect"}.`, 10, true);

  y -= 30;
  rect(40, y - 65, 515, 75, 0.98, 0.98, 0.99, true);
  rect(40, y - 65, 515, 75, 0.85, 0.88, 0.92, false);

  text(56, y - 18, "Remuneration Terms:", 10, true, 0.15, 0.3, 0.45);
  const gross = employee.salaryStructure?.gross || 120000;
  const basic = employee.salaryStructure?.basic || 80000;
  text(56, y - 36, `• Monthly Gross Compensation: ${currency} ${Number(gross).toLocaleString()}`, 9.5, true);
  text(56, y - 52, `• Basic Base Salary: ${currency} ${Number(basic).toLocaleString()} (Subject to Pakistan FBR income tax regulations)`, 9, false);

  y -= 95;
  text(40, y, "Terms of Employment & Compliance:", 10, true);
  y -= 16;
  text(40, y, "1. Standard working hours are 09:00 to 18:00 PKT (Monday through Friday) with biometric/remote check-in.", 9, false);
  y -= 14;
  text(40, y, "2. You are entitled to 20 statutory paid leaves per annum alongside comprehensive company medical coverage.", 9, false);
  y -= 14;
  text(40, y, "3. This offer is contingent upon successful verification of academic records and professional references.", 9, false);

  // Signatures
  y -= 60;
  line(40, y, 220, y);
  line(335, y, 515, y);
  text(40, y - 16, "Authorized Signatory", 10, true);
  text(40, y - 30, "Head of People & Culture / HR", 9, false, 0.45, 0.5, 0.55);
  text(40, y - 44, companyName, 8.5, false, 0.5, 0.55, 0.6);

  text(335, y - 16, "Candidate Acceptance", 10, true);
  text(335, y - 30, "Signature & Date of Acceptance", 9, false, 0.45, 0.5, 0.55);

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

export function generateExperienceLetterPdfBuffer(employee, companyName = "Saylani Tech HCM Lite") {
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

  // Header Banner
  rect(40, 735, 515, 68, 0.06, 0.25, 0.22, true);
  text(58, 776, companyName, 18, true, 1, 1, 1);
  text(58, 754, "OFFICIAL WORK EXPERIENCE & SERVICE CERTIFICATE", 10, false, 0.82, 0.95, 0.9);
  text(420, 776, "REF: HR-EXP-2026", 9, true, 0.9, 0.95, 0.95);
  text(420, 754, `Date: ${new Date().toISOString().slice(0, 10)}`, 9, false, 0.85, 0.9, 0.95);

  let y = 670;
  text(40, y, "TO WHOM IT MAY CONCERN", 12, true, 0.1, 0.3, 0.25);
  y -= 30;

  const empName = employee.fullName || "The Employee";
  const designation = employee.designationId?.title || "Engineer";
  const dept = employee.departmentId?.name || "Operations";
  const joining = employee.joiningDate || "2026-01-15";

  text(40, y, `This is to certify that Mr./Ms. ${empName} (Employee Code: ${employee.employeeCode || "N/A"}) has been`, 10, false);
  y -= 18;
  text(40, y, `employed with ${companyName} as a full-time ${designation} in the ${dept} department`, 10, false);
  y -= 18;
  text(40, y, `since ${joining}.`, 10, true);

  y -= 30;
  rect(40, y - 75, 515, 85, 0.97, 0.98, 0.99, true);
  rect(40, y - 75, 515, 85, 0.85, 0.88, 0.92, false);

  text(56, y - 20, "Service Record Summary:", 10, true, 0.1, 0.35, 0.3);
  text(56, y - 38, `• Designation: ${designation}`, 9.5, false);
  text(56, y - 52, `• Employment Status: Active & In Good Standing`, 9.5, true);
  text(56, y - 66, `• Conduct & Discipline: Exemplary (Zero disciplinary warnings / High Punctuality)`, 9, false);

  y -= 110;
  text(40, y, `During their tenure with us, ${empName} has demonstrated exceptional diligence, professional`, 10, false);
  y -= 18;
  text(40, y, "conduct, and remarkable leadership skills. We highly recommend them for any future endeavors.", 10, false);

  // Signatures
  y -= 75;
  line(40, y, 220, y);
  line(335, y, 515, y);
  text(40, y - 16, "Authorized Official Signatory", 10, true);
  text(40, y - 30, "Director of Human Resources", 9, false, 0.45, 0.5, 0.55);
  text(40, y - 44, `${companyName} Corporate Board`, 8.5, false, 0.5, 0.55, 0.6);

  text(335, y - 16, "Official Seal & Verification", 10, true);
  text(335, y - 30, "Saylani Tech Verified Electronic Stamp", 9, false, 0.45, 0.5, 0.55);

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



import mongoose from "mongoose";
import dns from "dns";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import { CompanySettings, Department, Designation, LeaveType, Holiday } from "../models/Organization.js";
import { Attendance, AttendanceCorrection } from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { Announcement, Notification } from "../models/CommsAudit.js";
import { PayrollRun, Payslip } from "../models/Payroll.js";
import Performance from "../models/Performance.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}

export async function seedRichMockData() {
  console.log("Seeding rich mock dataset for Hackathon demo...");

  // 1. Company Settings
  let settings = await CompanySettings.findOne();
  if (!settings) {
    settings = await CompanySettings.create({
      companyName: "Saylani Tech",
      tagline: "AI-assisted Human Capital Management",
      currency: "PKR",
      timezone: "Asia/Karachi",
      officeStartTime: "09:00",
      officeEndTime: "18:00",
      graceMinutes: 15,
      halfDayHours: 5,
      weekendDays: [0, 6],
      officeLocation: {
        lat: 24.8607,
        lng: 67.0011,
        address: "Zaitoon Ashraf IT Park, Karachi",
        radiusMeters: 500,
      },
      latePenaltyEnabled: true,
    });
  } else {
    settings.officeLocation.radiusMeters = Math.max(500, settings.officeLocation.radiusMeters || 150);
    await settings.save();
  }

  // 2. Departments
  const deptsData = [
    { name: "Engineering", code: "ENG", description: "Software Architecture & Infrastructure" },
    { name: "Human Resources", code: "HR", description: "People Operations, Talent & Culture" },
    { name: "Finance", code: "FIN", description: "Financial Planning, Payroll & Tax" },
    { name: "Product & Design", code: "PRD", description: "Product Management & UI/UX Design" },
    { name: "Marketing & Growth", code: "MKT", description: "Brand Strategy & Communications" },
  ];
  const deptMap = {};
  for (const d of deptsData) {
    let dept = await Department.findOne({ $or: [{ code: d.code }, { name: d.name }] });
    if (!dept) {
      dept = await Department.create(d);
    }
    deptMap[d.code] = dept;
  }

  // 3. Designations
  const desData = [
    { title: "Senior Software Engineer", code: "ENG", level: "Senior" },
    { title: "Frontend Developer", code: "ENG", level: "Mid" },
    { title: "HR Business Partner", code: "HR", level: "Lead" },
    { title: "Talent Acquisition Specialist", code: "HR", level: "Mid" },
    { title: "Financial Analyst", code: "FIN", level: "Senior" },
    { title: "Product Designer", code: "PRD", level: "Senior" },
  ];
  const desMap = {};
  for (const des of desData) {
    let d = await Designation.findOne({ title: des.title });
    if (!d) {
      d = await Designation.create({
        title: des.title,
        departmentId: deptMap[des.code]._id,
        level: des.level,
      });
    }
    desMap[des.title] = d;
  }

  // 4. Leave Types
  const leaveData = [
    { name: "Casual Leave", code: "casual", yearlyQuota: 12, isPaid: true, isUnlimited: false },
    { name: "Sick Leave", code: "sick", yearlyQuota: 10, isPaid: true, isUnlimited: false },
    { name: "Annual Leave", code: "annual", yearlyQuota: 14, isPaid: true, isUnlimited: false },
    { name: "Maternity/Paternity", code: "parental", yearlyQuota: 30, isPaid: true, isUnlimited: false },
  ];
  const leaveMap = {};
  for (const lt of leaveData) {
    let item = await LeaveType.findOne({ code: lt.code });
    if (!item) item = await LeaveType.create(lt);
    leaveMap[lt.code] = item;
  }

  // 5. Holidays
  const holidaysData = [
    { name: "Iqbal Day", date: "2026-11-09", description: "National Holiday" },
    { name: "Quaid-e-Azam Day", date: "2026-12-25", description: "Founder of Nation Day" },
  ];
  for (const h of holidaysData) {
    const exists = await Holiday.findOne({ date: h.date });
    if (!exists) await Holiday.create(h);
  }

  // 6. Users & Employees Dataset (Plaintext so User.js pre("save") hashes it cleanly once)
  const defaultPass = "Emp@123456";
  const adminPass = "Admin@123456";
  const hrPass = "Hr@123456";

  const employeesSeed = [
    {
      name: "Muhammad Ali",
      email: "employee@saylani.com",
      role: "employee",
      password: defaultPass,
      code: "EMP001",
      dept: "ENG",
      designation: "Senior Software Engineer",
      phone: "+92 300 1112222",
      basic: 120000,
      hra: 48000,
      medical: 12000,
      gross: 180000,
      joiningDate: "2026-01-15",
    },
    {
      name: "Zain Ahmed",
      email: "zain.ahmed@saylani.com",
      role: "employee",
      password: defaultPass,
      code: "EMP002",
      dept: "ENG",
      designation: "Frontend Developer",
      phone: "+92 321 3334444",
      basic: 80000,
      hra: 32000,
      medical: 8000,
      gross: 120000,
      joiningDate: "2026-02-01",
    },
    {
      name: "Ayesha Malik",
      email: "ayesha.malik@saylani.com",
      role: "employee",
      password: defaultPass,
      code: "EMP003",
      dept: "PRD",
      designation: "Product Designer",
      phone: "+92 333 5556666",
      basic: 90000,
      hra: 36000,
      medical: 9000,
      gross: 135000,
      joiningDate: "2026-03-10",
    },
    {
      name: "Bilal Tariq",
      email: "bilal.tariq@saylani.com",
      role: "employee",
      password: defaultPass,
      code: "EMP004",
      dept: "FIN",
      designation: "Financial Analyst",
      phone: "+92 345 7778888",
      basic: 100000,
      hra: 40000,
      medical: 10000,
      gross: 150000,
      joiningDate: "2026-01-20",
    },
  ];

  // Admin User
  let admin = await User.findOne({ email: "admin@saylani.com" });
  if (!admin) {
    admin = await User.create({
      name: "System Admin",
      email: "admin@saylani.com",
      password: adminPass,
      role: "admin",
      mustChangePassword: false,
    });
  } else {
    admin.password = adminPass;
    await admin.save();
  }

  // HR User
  let hr = await User.findOne({ email: "hr@saylani.com" });
  if (!hr) {
    hr = await User.create({
      name: "Fatima Khan",
      email: "hr@saylani.com",
      password: hrPass,
      role: "hr",
      mustChangePassword: false,
    });
  } else {
    hr.password = hrPass;
    await hr.save();
  }

  // Personal Admin
  let personalAdmin = await User.findOne({ email: "aliamirfajar421@gmail.com" });
  if (personalAdmin) {
    personalAdmin.password = adminPass;
    personalAdmin.role = "admin";
    personalAdmin.isActive = true;
    await personalAdmin.save();
  }

  const seededEmployees = [];
  for (const empData of employeesSeed) {
    let u = await User.findOne({ email: empData.email });
    if (!u) {
      u = await User.create({
        name: empData.name,
        email: empData.email,
        password: empData.password,
        role: "employee",
        mustChangePassword: false,
      });
    }

    let p = await Employee.findOne({ email: empData.email });
    if (!p) {
      p = await Employee.create({
        userId: u._id,
        employeeCode: empData.code,
        fullName: empData.name,
        email: empData.email,
        phone: empData.phone,
        address: "Karachi, Pakistan",
        gender: empData.name.includes("Ayesha") ? "female" : "male",
        departmentId: deptMap[empData.dept]._id,
        designationId: desMap[empData.designation]?._id || null,
        joiningDate: empData.joiningDate,
        employmentStatus: "active",
        salaryStructure: {
          basic: empData.basic,
          hraPercent: 40,
          medicalPercent: 10,
          hra: empData.hra,
          medical: empData.medical,
          otherAllowances: 0,
          gross: empData.gross,
        },
        emergencyContact: {
          name: "Family Contact",
          relationship: "Guardian",
          phone: "+92 300 0000000",
        },
      });
      u.employeeId = p._id;
      await u.save();
    }
    seededEmployees.push({ user: u, employee: p, meta: empData });
  }

  // 7. Seed Past Attendance (October 2026)
  const pastDates = [
    "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-26"
  ];

  for (const s of seededEmployees) {
    for (let i = 0; i < pastDates.length; i++) {
      const d = pastDates[i];
      const exists = await Attendance.findOne({ userId: s.user._id, date: d });
      if (!exists) {
        const isLate = (i + s.meta.code.charCodeAt(5)) % 4 === 0;
        const checkInHour = isLate ? "09:28:00" : "08:52:00";
        const checkOutHour = "18:10:00";
        const checkInAt = new Date(`${d}T${checkInHour}Z`);
        const checkOutAt = new Date(`${d}T${checkOutHour}Z`);

        await Attendance.create({
          userId: s.user._id,
          employeeId: s.employee._id,
          date: d,
          checkInAt,
          checkOutAt,
          workedHours: 8.5,
          isLate,
          lateMinutes: isLate ? 13 : 0,
          status: isLate ? "late" : "present",
          source: "camera",
          locationMeta: {
            distanceMeters: 45,
            radiusMeters: 500,
            accuracyMeters: 12,
            faceDetected: true,
            livenessVerified: true,
            faceMatchScore: 94,
          },
        });
      }
    }
  }

  // 8. Seed Leave Requests
  const mainEmp = seededEmployees[0];
  const secondEmp = seededEmployees[1];
  const thirdEmp = seededEmployees[2];

  if (mainEmp) {
    const exists = await LeaveRequest.findOne({ userId: mainEmp.user._id });
    if (!exists) {
      await LeaveRequest.create({
        userId: mainEmp.user._id,
        employeeId: mainEmp.employee._id,
        leaveTypeId: leaveMap["casual"]._id,
        leaveTypeCode: "casual",
        leaveTypeName: "Casual Leave",
        startDate: "2026-10-15",
        endDate: "2026-10-15",
        dates: ["2026-10-15"],
        workingDays: 1,
        totalDays: 1,
        reason: "Personal family commitment in Karachi",
        status: "approved",
        reviewedBy: hr._id,
        reviewedAt: new Date("2026-10-14T10:00:00Z"),
        reviewRemarks: "Approved by HR Fatima Khan",
      });
    }
  }

  if (secondEmp) {
    const exists = await LeaveRequest.findOne({ userId: secondEmp.user._id });
    if (!exists) {
      await LeaveRequest.create({
        userId: secondEmp.user._id,
        employeeId: secondEmp.employee._id,
        leaveTypeId: leaveMap["sick"]._id,
        leaveTypeCode: "sick",
        leaveTypeName: "Sick Leave",
        startDate: "2026-10-27",
        endDate: "2026-10-28",
        dates: ["2026-10-27", "2026-10-28"],
        workingDays: 2,
        totalDays: 2,
        reason: "Viral flu and high fever, taking doctor advised rest",
        status: "pending",
      });
    }
  }

  if (thirdEmp) {
    const exists = await LeaveRequest.findOne({ userId: thirdEmp.user._id });
    if (!exists) {
      await LeaveRequest.create({
        userId: thirdEmp.user._id,
        employeeId: thirdEmp.employee._id,
        leaveTypeId: leaveMap["annual"]._id,
        leaveTypeCode: "annual",
        leaveTypeName: "Annual Leave",
        startDate: "2026-11-02",
        endDate: "2026-11-06",
        dates: ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"],
        workingDays: 5,
        totalDays: 5,
        reason: "Annual family vacation to Swat Valley",
        status: "pending",
      });
    }
  }

  // 9. Seed Attendance Corrections
  if (secondEmp) {
    const exists = await AttendanceCorrection.findOne({ userId: secondEmp.user._id });
    if (!exists) {
      await AttendanceCorrection.create({
        userId: secondEmp.user._id,
        employeeId: secondEmp.employee._id,
        date: "2026-10-23",
        requestedCheckIn: "09:00",
        requestedCheckOut: "18:00",
        reason: "Was presenting onsite at Saylani Tech Park, missed biometric scanner tap",
        status: "pending",
      });
    }
  }

  // 10. Seed Announcements
  const announcementsSeed = [
    {
      title: "🎉 Saylani Hackathon 2026 Finale — HCM Lite Active",
      body: "Welcome team! All 9 modules are now live including AI Roman Urdu Comms, Face Biometrics, and Automated Payroll.",
      departmentId: null,
      priority: "urgent",
      authorId: admin._id,
      authorName: "System Admin",
      authorRole: "admin",
    },
    {
      title: "📢 Policy Update: Camera Geofencing & Flexible WFH",
      body: "Employees offsite can use 'Remote / WFH Mode' check-in with live front camera verification.",
      departmentId: null,
      priority: "important",
      authorId: hr._id,
      authorName: "Fatima Khan",
      authorRole: "hr",
    },
    {
      title: "⭐ Engineering Sprint Retrospective this Thursday",
      body: "All engineering leads and devs to join the sprint retro at 3:00 PM in Conference Room A.",
      departmentId: deptMap["ENG"]._id,
      priority: "normal",
      authorId: admin._id,
      authorName: "System Admin",
      authorRole: "admin",
    },
  ];
  for (const a of announcementsSeed) {
    const exists = await Announcement.findOne({ title: a.title });
    if (!exists) await Announcement.create(a);
  }

  // 11. Seed Draft Payroll Run for October 2026
  let pRun = await PayrollRun.findOne({ month: 10, year: 2026 });
  if (!pRun) {
    pRun = await PayrollRun.create({
      month: 10,
      year: 2026,
      status: "draft",
      workingDaysInMonth: 22,
      totalEmployees: seededEmployees.length,
      totalGross: 585000,
      totalNet: 545000,
      totalTax: 32000,
      totalDeductions: 40000,
      latePenaltyApplied: true,
      preparedBy: hr._id,
    });

    for (const s of seededEmployees) {
      const basic = s.meta.basic;
      const gross = s.meta.gross;
      const tax = Math.round(gross * 0.05);
      const netPay = gross - tax;

      await Payslip.create({
        payrollRunId: pRun._id,
        employeeId: s.employee._id,
        userId: s.user._id,
        month: 10,
        year: 2026,
        status: "draft",
        employeeSnapshot: {
          employeeCode: s.meta.code,
          fullName: s.meta.name,
          email: s.meta.email,
          departmentName: deptMap[s.meta.dept].name,
          designationTitle: s.meta.designation,
          joiningDate: s.meta.joiningDate,
        },
        basic,
        hra: s.meta.hra,
        medical: s.meta.medical,
        otherAllowances: 0,
        gross,
        proratedGross: gross,
        workingDaysInMonth: 22,
        eligibleWorkingDays: 22,
        presentDays: 21,
        paidLeaveDays: 1,
        unpaidLeaveDays: 0,
        absentDays: 0,
        halfDays: 0,
        lateCount: 1,
        latePenaltyDays: 0,
        deductibleDays: 0,
        perDayRate: Math.round(gross / 22),
        attendanceDeduction: 0,
        annualizedGross: gross * 12,
        annualTax: tax * 12,
        monthlyTax: tax,
        netPay,
      });
    }
  }

  // 12. Seed Performance & OKR Goals for Employees
  for (const s of seededEmployees) {
    const existingPerf = await Performance.findOne({ employeeId: s.employee._id, period: "Q4 2026" });
    if (!existingPerf) {
      await Performance.create({
        employeeId: s.employee._id,
        userId: s.user._id,
        period: "Q4 2026",
        goals: [
          {
            title: `Deliver ${s.meta.dept} Core Infrastructure Milestones`,
            description: "Achieve sprint deliverables with sub-100ms response targets.",
            targetMetric: "100% on-schedule release",
            progress: 85,
            status: "in_progress",
          },
          {
            title: "Punctuality & Punctuality Streak Maintenance",
            description: "Maintain verified biometric attendance and 0 unexcused absences.",
            targetMetric: "98% on-time check-ins",
            progress: 100,
            status: "completed",
          },
        ],
        managerRating: 5,
        managerFeedback: "Exemplary performance, great cross-functional collaboration, and proactive technical execution.",
        aiSummary: "Top Tier Performer. Verified 18-Day on-time streak with high milestone completion.",
      });
    }
  }

  console.log("Rich mock dataset seeded successfully!");
  return {
    success: true,
    message: "Rich mock dataset seeded successfully (Employees, Attendance, Leaves, Announcements, Payroll, Performance)!",
  };
}

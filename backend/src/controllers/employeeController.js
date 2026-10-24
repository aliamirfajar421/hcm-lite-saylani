import User from "../models/User.js";
import Employee from "../models/Employee.js";
import { Department, Designation } from "../models/Organization.js";
import { Attendance } from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { Payslip } from "../models/Payroll.js";
import {
  computeSalaryStructure,
  isValidEmail,
  isValidIsoDate,
  validateEmployeeCsvRows,
} from "../services/rulesService.js";
import { parseCsv, toCsv } from "../services/csvService.js";
import { computeLeaveBalanceForUser } from "../services/analyticsService.js";
import { recordAudit } from "../services/auditService.js";

/**
 * #06 HR Registers an Employee (creates login with temporary password + mustChangePassword: true)
 */
export const registerEmployee = async (req, res) => {
  try {
    const {
      employeeCode,
      fullName,
      email,
      phone = "",
      address = "",
      gender = "male",
      departmentId,
      designationId = null,
      joiningDate,
      employmentStatus = "active",
      basicSalary,
      hraPercent = 40,
      medicalPercent = 10,
      otherAllowances = 0,
      temporaryPassword,
    } = req.body;

    if (!employeeCode || !fullName || !email || !departmentId || !joiningDate || !basicSalary) {
      return res.status(400).json({
        message: "Employee code, full name, email, department, joining date, and basic salary are required",
      });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Valid email address is required" });
    }
    if (!isValidIsoDate(joiningDate)) {
      return res.status(400).json({ message: "Joining date must be in YYYY-MM-DD format" });
    }
    if (Number(basicSalary) <= 0) {
      return res.status(400).json({ message: "Basic salary must be greater than 0" });
    }

    const tempPass = String(temporaryPassword || `Temp@${Math.floor(1000 + Math.random() * 9000)}`);
    if (tempPass.length < 6) {
      return res.status(400).json({ message: "Temporary password must be at least 6 characters" });
    }

    const cleanCode = String(employeeCode).trim().toUpperCase();
    const cleanEmail = String(email).trim().toLowerCase();

    const [dept, existingCode, existingUser] = await Promise.all([
      Department.findById(departmentId),
      Employee.findOne({ employeeCode: cleanCode }),
      User.findOne({ email: cleanEmail }),
    ]);

    if (!dept) return res.status(404).json({ message: "Selected department does not exist" });
    if (existingCode) return res.status(409).json({ message: `Employee code '${cleanCode}' is already in use` });
    if (existingUser) return res.status(409).json({ message: `Email '${cleanEmail}' is already registered` });

    const salaryStructure = computeSalaryStructure({
      basic: Number(basicSalary),
      hraPercent: Number(hraPercent),
      medicalPercent: Number(medicalPercent),
      otherAllowances: Number(otherAllowances),
    });

    const user = await User.create({
      name: String(fullName).trim(),
      email: cleanEmail,
      password: tempPass,
      role: "employee",
      mustChangePassword: true,
      isActive: true,
    });

    try {
      const emp = await Employee.create({
        userId: user._id,
        employeeCode: cleanCode,
        fullName: String(fullName).trim(),
        email: cleanEmail,
        phone: String(phone).trim(),
        address: String(address).trim(),
        gender: ["male", "female", "other"].includes(gender) ? gender : "male",
        departmentId,
        designationId: designationId || null,
        joiningDate,
        employmentStatus: ["active", "probation", "exited"].includes(employmentStatus)
          ? employmentStatus
          : "active",
        salaryStructure,
      });

      user.employeeId = emp._id;
      await user.save();

      const populated = await Employee.findById(emp._id)
        .populate("departmentId", "name code")
        .populate("designationId", "title level")
        .lean();

      await recordAudit({
        actor: req.user,
        action: "EMPLOYEE_REGISTERED",
        entityType: "Employee",
        entityId: emp._id,
        summary: `Registered employee '${emp.fullName}' (${emp.employeeCode})`,
        after: {
          employeeCode: emp.employeeCode,
          email: emp.email,
          department: dept.name,
          grossSalary: salaryStructure.gross,
        },
      });

      res.status(201).json({
        message: "Employee registered and login created",
        employee: populated,
        credentials: {
          email: cleanEmail,
          temporaryPassword: tempPass,
          mustChangeOnFirstLogin: true,
        },
      });
    } catch (innerErr) {
      await User.findByIdAndDelete(user._id);
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #07 Employee Directory with Server-Side Search, Filters & Pagination
 * Scope Guard: Employee only receives their own row!
 */
export const listEmployees = async (req, res) => {
  try {
    if (req.user.role === "employee") {
      const own = await Employee.findOne({ userId: req.user._id })
        .populate("departmentId", "name code")
        .populate("designationId", "title level")
        .lean();
      return res.json({
        employees: own ? [own] : [],
        total: own ? 1 : 0,
        page: 1,
        pages: 1,
      });
    }

    const { q = "", departmentId = "", designationId = "", status = "", page = 1, limit = 20 } = req.query;
    const filter = {};
    if (departmentId) filter.departmentId = departmentId;
    if (designationId) filter.designationId = designationId;
    if (status) filter.employmentStatus = status;

    if (q && String(q).trim()) {
      const escaped = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { fullName: new RegExp(escaped, "i") },
        { employeeCode: new RegExp(escaped, "i") },
        { email: new RegExp(escaped, "i") },
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

    const [total, employees] = await Promise.all([
      Employee.countDocuments(filter),
      Employee.find(filter)
        .populate("departmentId", "name code")
        .populate("designationId", "title level")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    res.json({
      employees,
      total,
      page: pageNum,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #07 Employee 360 Profile (Strict Scope Guard: Employee can ONLY view their own 360 profile)
 */
export const getEmployee360 = async (req, res) => {
  try {
    const paramId = req.params.id;
    let emp;

    if (paramId === "me") {
      emp = await Employee.findOne({ userId: req.user._id })
        .populate("departmentId", "name code")
        .populate("designationId", "title level")
        .lean();
    } else {
      if (req.user.role === "employee" && String(req.user.employeeId) !== String(paramId)) {
        return res.status(403).json({
          message: "Access denied: Employees can only view their own profile and records",
        });
      }
      emp = await Employee.findById(paramId)
        .populate("departmentId", "name code")
        .populate("designationId", "title level")
        .lean();
    }

    if (!emp) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    const [recentAttendance, leaveBalances, recentLeaves, payslips] = await Promise.all([
      Attendance.find({ userId: emp.userId }).sort({ date: -1 }).limit(15).lean(),
      computeLeaveBalanceForUser(emp.userId),
      LeaveRequest.find({ userId: emp.userId }).sort({ createdAt: -1 }).limit(10).lean(),
      Payslip.find({ employeeId: emp._id }).sort({ year: -1, month: -1 }).limit(12).lean(),
    ]);

    res.json({
      employee: emp,
      recentAttendance,
      leaveBalances,
      recentLeaves,
      payslips,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #06 HR Edits Employee Details
 */
export const updateEmployee = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    const before = emp.toObject();

    const {
      fullName,
      phone,
      address,
      gender,
      departmentId,
      designationId,
      joiningDate,
      exitDate,
      employmentStatus,
    } = req.body;

    if (fullName !== undefined) {
      emp.fullName = String(fullName).trim();
      await User.findByIdAndUpdate(emp.userId, { name: emp.fullName });
    }
    if (phone !== undefined) emp.phone = String(phone).trim();
    if (address !== undefined) emp.address = String(address).trim();
    if (gender && ["male", "female", "other"].includes(gender)) emp.gender = gender;
    if (departmentId) emp.departmentId = departmentId;
    if (designationId !== undefined) emp.designationId = designationId || null;
    if (joiningDate && isValidIsoDate(joiningDate)) emp.joiningDate = joiningDate;
    if (employmentStatus && ["active", "probation", "exited"].includes(employmentStatus)) {
      emp.employmentStatus = employmentStatus;
      if (employmentStatus === "exited") {
        emp.exitDate = isValidIsoDate(exitDate) ? exitDate : new Date().toISOString().slice(0, 10);
        await User.findByIdAndUpdate(emp.userId, { isActive: false, refreshToken: null });
      } else {
        emp.exitDate = null;
      }
    } else if (exitDate !== undefined) {
      emp.exitDate = exitDate && isValidIsoDate(exitDate) ? exitDate : null;
    }

    await emp.save();

    await recordAudit({
      actor: req.user,
      action: "EMPLOYEE_UPDATED",
      entityType: "Employee",
      entityId: emp._id,
      summary: `Updated employee details for '${emp.fullName}' (${emp.employeeCode})`,
      before: { fullName: before.fullName, employmentStatus: before.employmentStatus, departmentId: before.departmentId },
      after: { fullName: emp.fullName, employmentStatus: emp.employmentStatus, departmentId: emp.departmentId },
    });

    const updated = await Employee.findById(emp._id)
      .populate("departmentId", "name code")
      .populate("designationId", "title level")
      .lean();

    res.json({ message: "Employee updated", employee: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #06 Employee Self-Service: Edit ONLY own phone and address
 */
export const updateOwnContact = async (req, res) => {
  try {
    const emp = await Employee.findOne({ userId: req.user._id });
    if (!emp) return res.status(404).json({ message: "Employee profile not found" });

    const before = { phone: emp.phone, address: emp.address };
    const { phone, address } = req.body;
    if (phone !== undefined) emp.phone = String(phone).trim();
    if (address !== undefined) emp.address = String(address).trim();
    await emp.save();

    await recordAudit({
      actor: req.user,
      action: "OWN_CONTACT_UPDATED",
      entityType: "Employee",
      entityId: emp._id,
      summary: `Employee '${emp.email}' updated phone/address`,
      before,
      after: { phone: emp.phone, address: emp.address },
    });

    res.json({ message: "Contact details updated", employee: emp });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #14 HR Manages Salary Structure per Employee
 */
export const updateSalaryStructure = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ message: "Employee not found" });

    const { basic, hraPercent = 40, medicalPercent = 10, otherAllowances = 0 } = req.body;
    if (!basic || Number(basic) <= 0) {
      return res.status(400).json({ message: "Basic salary must be greater than 0" });
    }

    const before = { ...emp.salaryStructure?.toObject?.() || emp.salaryStructure };
    emp.salaryStructure = computeSalaryStructure({
      basic: Number(basic),
      hraPercent: Number(hraPercent),
      medicalPercent: Number(medicalPercent),
      otherAllowances: Number(otherAllowances),
    });
    await emp.save();

    await recordAudit({
      actor: req.user,
      action: "SALARY_STRUCTURE_UPDATED",
      entityType: "Employee",
      entityId: emp._id,
      summary: `Updated salary structure for '${emp.fullName}' (Gross: ${emp.salaryStructure.gross})`,
      before,
      after: emp.salaryStructure,
    });

    res.json({ message: "Salary structure updated", salaryStructure: emp.salaryStructure });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #08 CSV Import with Dry-Run Validation Report & Commit
 */
export const importEmployeesCsv = async (req, res) => {
  try {
    const { csvText, dryRun = true, defaultTemporaryPassword = "ChangeMe@123" } = req.body;
    if (!csvText || !String(csvText).trim()) {
      return res.status(400).json({ message: "CSV content is required" });
    }

    const parsedRows = parseCsv(csvText);
    if (parsedRows.length === 0) {
      return res.status(400).json({
        message: "CSV contains no data rows. Expected header: employeeCode,fullName,email,department,joiningDate,basicSalary",
      });
    }

    const [departments, existingUsers, existingEmps, designations] = await Promise.all([
      Department.find({ isActive: true }).lean(),
      User.find().select("email").lean(),
      Employee.find().select("employeeCode email").lean(),
      Designation.find({ isActive: true }).lean(),
    ]);

    const departmentLookup = new Map();
    departments.forEach((d) => {
      departmentLookup.set(d.name.toLowerCase(), d);
      departmentLookup.set(d.code.toLowerCase(), d);
    });

    const designationLookup = new Map();
    designations.forEach((ds) => {
      designationLookup.set(ds.title.toLowerCase(), ds);
    });

    const existingEmails = new Set([
      ...existingUsers.map((u) => u.email.toLowerCase()),
      ...existingEmps.map((e) => e.email.toLowerCase()),
    ]);
    const existingCodes = new Set(existingEmps.map((e) => e.employeeCode.toUpperCase()));

    const { validRows, errors } = validateEmployeeCsvRows({
      rows: parsedRows,
      existingEmails,
      existingCodes,
      departmentLookup,
    });

    if (dryRun || errors.length > 0 && req.body.strictAllOrNothing) {
      return res.json({
        dryRun: Boolean(dryRun),
        totalRows: parsedRows.length,
        validCount: validRows.length,
        errorCount: errors.length,
        errors,
        preview: validRows,
      });
    }

    if (validRows.length === 0) {
      return res.status(422).json({
        message: "No valid rows to import",
        totalRows: parsedRows.length,
        validCount: 0,
        errorCount: errors.length,
        errors,
      });
    }

    const created = [];
    for (const row of validRows) {
      const salaryStructure = computeSalaryStructure({ basic: row.basicSalary });
      const desigDoc = row.designationTitle
        ? designationLookup.get(row.designationTitle.toLowerCase())
        : null;

      const user = await User.create({
        name: row.fullName,
        email: row.email,
        password: defaultTemporaryPassword,
        role: "employee",
        mustChangePassword: true,
        isActive: true,
      });

      const emp = await Employee.create({
        userId: user._id,
        employeeCode: row.employeeCode,
        fullName: row.fullName,
        email: row.email,
        phone: row.phone,
        address: row.address,
        gender: row.gender,
        departmentId: row.departmentId,
        designationId: desigDoc ? desigDoc._id : null,
        joiningDate: row.joiningDate,
        employmentStatus: "active",
        salaryStructure,
      });

      user.employeeId = emp._id;
      await user.save();
      created.push({ employeeCode: emp.employeeCode, fullName: emp.fullName, email: emp.email });
    }

    await recordAudit({
      actor: req.user,
      action: "EMPLOYEES_CSV_IMPORTED",
      entityType: "Employee",
      summary: `Imported ${created.length} employee(s) via CSV`,
      after: { importedCount: created.length, skippedErrors: errors.length },
    });

    res.status(201).json({
      dryRun: false,
      importedCount: created.length,
      errorCount: errors.length,
      errors,
      created,
      defaultTemporaryPassword,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #08 CSV Export
 */
export const exportEmployeesCsv = async (_req, res) => {
  try {
    const employees = await Employee.find()
      .populate("departmentId", "name code")
      .populate("designationId", "title")
      .sort({ employeeCode: 1 })
      .lean();

    const headers = [
      { key: "employeeCode", label: "employeeCode" },
      { key: "fullName", label: "fullName" },
      { key: "email", label: "email" },
      { key: "department", label: "department" },
      { key: "designation", label: "designation" },
      { key: "gender", label: "gender" },
      { key: "joiningDate", label: "joiningDate" },
      { key: "employmentStatus", label: "employmentStatus" },
      { key: "basicSalary", label: "basicSalary" },
      { key: "grossSalary", label: "grossSalary" },
      { key: "phone", label: "phone" },
    ];

    const records = employees.map((e) => ({
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      email: e.email,
      department: e.departmentId?.name || "",
      designation: e.designationId?.title || "",
      gender: e.gender,
      joiningDate: e.joiningDate,
      employmentStatus: e.employmentStatus,
      basicSalary: e.salaryStructure?.basic || 0,
      grossSalary: e.salaryStructure?.gross || 0,
      phone: e.phone || "",
    }));

    const csv = toCsv(headers, records);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="employees_export.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


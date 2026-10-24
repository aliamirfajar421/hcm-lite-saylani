import { CompanySettings, Department, Designation, LeaveType, Holiday } from "../models/Organization.js";
import Employee from "../models/Employee.js";
import { recordAudit } from "../services/auditService.js";
import { isValidIsoDate } from "../services/rulesService.js";

/**
 * #03 Company Settings (Admin: Manage, HR/Employee: View policy & geofence parameters)
 */
export const getCompanySettings = async (_req, res) => {
  try {
    const settings = await CompanySettings.findOne().lean();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateCompanySettings = async (req, res) => {
  try {
    let settings = await CompanySettings.findOne();
    const before = settings ? settings.toObject() : null;

    const {
      companyName,
      tagline,
      currency,
      timezone,
      officeStartTime,
      officeEndTime,
      graceMinutes,
      halfDayHours,
      weekendDays,
      officeLocation,
      storeAttendancePhoto,
      latePenaltyEnabled,
    } = req.body;

    if (!settings) {
      settings = await CompanySettings.create({
        companyName: companyName || "HCM Lite",
        tagline,
        currency,
        timezone,
        officeStartTime,
        officeEndTime,
        graceMinutes,
        halfDayHours,
        weekendDays,
        officeLocation,
        storeAttendancePhoto,
        latePenaltyEnabled,
      });
    } else {
      if (companyName !== undefined) settings.companyName = String(companyName).trim();
      if (tagline !== undefined) settings.tagline = String(tagline).trim();
      if (currency !== undefined) settings.currency = String(currency).trim();
      if (timezone !== undefined) settings.timezone = String(timezone).trim();
      if (officeStartTime !== undefined) settings.officeStartTime = officeStartTime;
      if (officeEndTime !== undefined) settings.officeEndTime = officeEndTime;
      if (graceMinutes !== undefined) settings.graceMinutes = Number(graceMinutes);
      if (halfDayHours !== undefined) settings.halfDayHours = Number(halfDayHours);
      if (Array.isArray(weekendDays)) settings.weekendDays = weekendDays.map(Number);
      if (officeLocation && typeof officeLocation === "object") {
        settings.officeLocation = {
          lat: Number(officeLocation.lat ?? settings.officeLocation?.lat ?? 24.8607),
          lng: Number(officeLocation.lng ?? settings.officeLocation?.lng ?? 67.0011),
          address: String(officeLocation.address ?? settings.officeLocation?.address ?? "Head Office").trim(),
          radiusMeters: Number(officeLocation.radiusMeters ?? settings.officeLocation?.radiusMeters ?? 150),
        };
      }
      if (storeAttendancePhoto !== undefined) settings.storeAttendancePhoto = Boolean(storeAttendancePhoto);
      if (latePenaltyEnabled !== undefined) settings.latePenaltyEnabled = Boolean(latePenaltyEnabled);
      await settings.save();
    }

    await recordAudit({
      actor: req.user,
      action: "COMPANY_SETTINGS_UPDATED",
      entityType: "CompanySettings",
      entityId: settings._id,
      summary: `Updated company settings for '${settings.companyName}'`,
      before,
      after: settings.toObject(),
    });

    res.json({ message: "Company settings saved (applies to new records)", settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #04 Departments CRUD
 */
export const listDepartments = async (_req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 }).lean();
    res.json({ departments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ message: "Department name and code are required" });
    }
    const dept = await Department.create({
      name: String(name).trim(),
      code: String(code).trim().toUpperCase(),
      description: String(description || "").trim(),
    });

    await recordAudit({
      actor: req.user,
      action: "DEPARTMENT_CREATED",
      entityType: "Department",
      entityId: dept._id,
      summary: `Created department '${dept.name}' (${dept.code})`,
      after: dept.toObject(),
    });

    res.status(201).json({ department: dept });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Department name or code already exists" });
    }
    res.status(500).json({ message: err.message });
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ message: "Department not found" });
    const before = dept.toObject();

    const { name, code, description, isActive } = req.body;
    if (name !== undefined) dept.name = String(name).trim();
    if (code !== undefined) dept.code = String(code).trim().toUpperCase();
    if (description !== undefined) dept.description = String(description).trim();
    if (isActive !== undefined) dept.isActive = Boolean(isActive);
    await dept.save();

    await recordAudit({
      actor: req.user,
      action: "DEPARTMENT_UPDATED",
      entityType: "Department",
      entityId: dept._id,
      summary: `Updated department '${dept.name}'`,
      before,
      after: dept.toObject(),
    });

    res.json({ department: dept });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const assigned = await Employee.countDocuments({ departmentId: req.params.id });
    if (assigned > 0) {
      return res.status(409).json({ message: `Cannot delete department with ${assigned} assigned employee(s)` });
    }
    const dept = await Department.findByIdAndDelete(req.params.id);
    if (!dept) return res.status(404).json({ message: "Department not found" });

    await recordAudit({
      actor: req.user,
      action: "DEPARTMENT_DELETED",
      entityType: "Department",
      entityId: dept._id,
      summary: `Deleted department '${dept.name}'`,
      before: dept.toObject(),
    });

    res.json({ message: "Department deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #04 Designations CRUD
 */
export const listDesignations = async (_req, res) => {
  try {
    const designations = await Designation.find()
      .populate("departmentId", "name code")
      .sort({ title: 1 })
      .lean();
    res.json({ designations });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createDesignation = async (req, res) => {
  try {
    const { title, departmentId, level = "Mid" } = req.body;
    if (!title) return res.status(400).json({ message: "Designation title is required" });
    const desig = await Designation.create({
      title: String(title).trim(),
      departmentId: departmentId || null,
      level: String(level).trim(),
    });

    await recordAudit({
      actor: req.user,
      action: "DESIGNATION_CREATED",
      entityType: "Designation",
      entityId: desig._id,
      summary: `Created designation '${desig.title}'`,
      after: desig.toObject(),
    });

    res.status(201).json({ designation: desig });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteDesignation = async (req, res) => {
  try {
    const desig = await Designation.findByIdAndDelete(req.params.id);
    if (!desig) return res.status(404).json({ message: "Designation not found" });

    await recordAudit({
      actor: req.user,
      action: "DESIGNATION_DELETED",
      entityType: "Designation",
      entityId: desig._id,
      summary: `Deleted designation '${desig.title}'`,
      before: desig.toObject(),
    });

    res.json({ message: "Designation deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #04 Leave Types & Quotas CRUD
 */
export const listLeaveTypes = async (_req, res) => {
  try {
    const leaveTypes = await LeaveType.find().sort({ name: 1 }).lean();
    res.json({ leaveTypes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createLeaveType = async (req, res) => {
  try {
    const { name, code, yearlyQuota = 0, isPaid = true, isUnlimited = false, description = "" } = req.body;
    if (!name || !code) {
      return res.status(400).json({ message: "Leave type name and code are required" });
    }
    const lt = await LeaveType.create({
      name: String(name).trim(),
      code: String(code).trim().toLowerCase(),
      yearlyQuota: isUnlimited ? 0 : Number(yearlyQuota),
      isPaid: Boolean(isPaid),
      isUnlimited: Boolean(isUnlimited),
      description: String(description).trim(),
    });

    await recordAudit({
      actor: req.user,
      action: "LEAVE_TYPE_CREATED",
      entityType: "LeaveType",
      entityId: lt._id,
      summary: `Created leave type '${lt.name}' (quota: ${lt.isUnlimited ? "unlimited" : lt.yearlyQuota})`,
      after: lt.toObject(),
    });

    res.status(201).json({ leaveType: lt });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Leave type code already exists" });
    }
    res.status(500).json({ message: err.message });
  }
};

export const updateLeaveType = async (req, res) => {
  try {
    const lt = await LeaveType.findById(req.params.id);
    if (!lt) return res.status(404).json({ message: "Leave type not found" });
    const before = lt.toObject();

    const { name, yearlyQuota, isPaid, isUnlimited, isActive } = req.body;
    if (name !== undefined) lt.name = String(name).trim();
    if (isUnlimited !== undefined) lt.isUnlimited = Boolean(isUnlimited);
    if (yearlyQuota !== undefined) lt.yearlyQuota = lt.isUnlimited ? 0 : Number(yearlyQuota);
    if (isPaid !== undefined) lt.isPaid = Boolean(isPaid);
    if (isActive !== undefined) lt.isActive = Boolean(isActive);
    await lt.save();

    await recordAudit({
      actor: req.user,
      action: "LEAVE_TYPE_UPDATED",
      entityType: "LeaveType",
      entityId: lt._id,
      summary: `Updated leave type '${lt.name}'`,
      before,
      after: lt.toObject(),
    });

    res.json({ leaveType: lt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #04 Public Holidays CRUD
 */
export const listHolidays = async (_req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 }).lean();
    res.json({ holidays });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createHoliday = async (req, res) => {
  try {
    const { name, date, description = "" } = req.body;
    if (!name || !isValidIsoDate(date)) {
      return res.status(400).json({ message: "Holiday name and valid YYYY-MM-DD date are required" });
    }
    const holiday = await Holiday.create({
      name: String(name).trim(),
      date,
      description: String(description).trim(),
    });

    await recordAudit({
      actor: req.user,
      action: "HOLIDAY_CREATED",
      entityType: "Holiday",
      entityId: holiday._id,
      summary: `Added public holiday '${holiday.name}' on ${holiday.date}`,
      after: holiday.toObject(),
    });

    res.status(201).json({ holiday });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "A holiday already exists on that date" });
    }
    res.status(500).json({ message: err.message });
  }
};

export const deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);
    if (!holiday) return res.status(404).json({ message: "Holiday not found" });

    await recordAudit({
      actor: req.user,
      action: "HOLIDAY_DELETED",
      entityType: "Holiday",
      entityId: holiday._id,
      summary: `Removed public holiday '${holiday.name}' (${holiday.date})`,
      before: holiday.toObject(),
    });

    res.json({ message: "Holiday deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


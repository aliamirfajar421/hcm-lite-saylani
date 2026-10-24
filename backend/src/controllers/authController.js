import User from "../models/User.js";
import Employee from "../models/Employee.js";
import { CompanySettings, Department, LeaveType } from "../models/Organization.js";
import { Notification } from "../models/CommsAudit.js";
import jwt from "jsonwebtoken";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import { recordAudit, sendNotification } from "../services/auditService.js";
import { isValidEmail } from "../services/rulesService.js";

/**
 * Optional env bootstrap if ADMIN_EMAIL & ADMIN_PASSWORD are provided on an empty DB
 */
export async function ensureEnvBootstrapIfConfigured() {
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  if (!adminEmail || !adminPassword) return;

  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) return;

  const companyName = (process.env.COMPANY_NAME || "HCM Lite Corp").trim();
  await CompanySettings.create({ companyName });
  const admin = await User.create({
    name: "System Admin",
    email: adminEmail,
    password: adminPassword,
    role: "admin",
    mustChangePassword: false,
  });
  await recordAudit({
    actor: admin,
    action: "ENV_BOOTSTRAP_SETUP",
    entityType: "CompanySettings",
    summary: `Initialized ${companyName} and Admin from environment variables`,
  });
}

export const getSetupStatus = async (_req, res) => {
  try {
    const [adminCount, settings] = await Promise.all([
      User.countDocuments({ role: "admin" }),
      CompanySettings.findOne().lean(),
    ]);
    res.json({
      initialized: adminCount > 0 && Boolean(settings),
      companyName: settings?.companyName || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #01 First-run setup: Company profile + Admin account
 */
export const firstRunSetup = async (req, res) => {
  try {
    const existingAdmin = await User.countDocuments({ role: "admin" });
    if (existingAdmin > 0) {
      return res.status(409).json({ message: "System is already initialized. Please sign in." });
    }

    const {
      companyName,
      tagline,
      currency = "PKR",
      officeStartTime = "09:00",
      officeEndTime = "18:00",
      graceMinutes = 15,
      halfDayHours = 5,
      weekendDays = [0, 6],
      officeLat = 24.8607,
      officeLng = 67.0011,
      officeAddress = "Head Office",
      radiusMeters = 150,
      adminName,
      adminEmail,
      adminPassword,
      initialDepartments = [],
      initialLeaveTypes = [],
    } = req.body;

    if (!companyName || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        message: "Company name, Admin name, Admin email, and password are required",
      });
    }
    if (!isValidEmail(adminEmail)) {
      return res.status(400).json({ message: "Please provide a valid Admin email address" });
    }
    if (String(adminPassword).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const settings = await CompanySettings.create({
      companyName: String(companyName).trim(),
      tagline: tagline || "AI-assisted Human Capital Management",
      currency: currency || "PKR",
      officeStartTime,
      officeEndTime,
      graceMinutes: Number(graceMinutes),
      halfDayHours: Number(halfDayHours),
      weekendDays: Array.isArray(weekendDays) ? weekendDays.map(Number) : [0, 6],
      officeLocation: {
        lat: Number(officeLat),
        lng: Number(officeLng),
        address: String(officeAddress || "Head Office").trim(),
        radiusMeters: Number(radiusMeters || 150),
      },
    });

    const admin = await User.create({
      name: String(adminName).trim(),
      email: String(adminEmail).trim().toLowerCase(),
      password: adminPassword,
      role: "admin",
      mustChangePassword: false,
    });

    // Optional setup wizard departments & leave types submitted explicitly by Admin
    if (Array.isArray(initialDepartments) && initialDepartments.length > 0) {
      for (const d of initialDepartments) {
        if (d?.name && d?.code) {
          await Department.create({
            name: String(d.name).trim(),
            code: String(d.code).trim().toUpperCase(),
            description: String(d.description || "").trim(),
          }).catch(() => null);
        }
      }
    }

    if (Array.isArray(initialLeaveTypes) && initialLeaveTypes.length > 0) {
      for (const lt of initialLeaveTypes) {
        if (lt?.name && lt?.code) {
          await LeaveType.create({
            name: String(lt.name).trim(),
            code: String(lt.code).trim().toLowerCase(),
            yearlyQuota: Number(lt.yearlyQuota || 0),
            isPaid: lt.isPaid !== false,
            isUnlimited: Boolean(lt.isUnlimited),
          }).catch(() => null);
        }
      }
    }

    const accessToken = generateAccessToken(admin._id, admin.role);
    const refreshToken = generateRefreshToken(admin._id);
    admin.refreshToken = refreshToken;
    await admin.save();

    await recordAudit({
      actor: admin,
      action: "FIRST_RUN_SETUP",
      entityType: "CompanySettings",
      entityId: settings._id,
      summary: `Initialized company '${settings.companyName}' and Admin '${admin.email}'`,
      after: { companyName: settings.companyName, adminEmail: admin.email },
    });

    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: String(admin._id),
        name: admin.name,
        email: admin.email,
        role: admin.role,
        employeeId: null,
        mustChangePassword: false,
      },
      companyName: settings.companyName,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated by Admin" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    const settings = await CompanySettings.findOne().lean();

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId ? String(user.employeeId) : null,
        mustChangePassword: Boolean(user.mustChangePassword),
      },
      companyName: settings?.companyName || "HCM Lite",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || "default_jwt_refresh_secret");
    } catch {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await User.findById(payload.userId);
    if (!user || !user.isActive || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid or revoked refresh token" });
    }

    const newAccessToken = generateAccessToken(user._id, user.role);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const logout = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user) {
      user.refreshToken = null;
      await user.save();
    }
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const me = async (req, res) => {
  try {
    const [user, settings, unreadNotifications] = await Promise.all([
      User.findById(req.user.userId).select("-password -refreshToken").lean(),
      CompanySettings.findOne().lean(),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
    ]);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId ? String(user.employeeId) : null,
        mustChangePassword: Boolean(user.mustChangePassword),
        hasEnrolledFace: Array.isArray(user.faceDescriptor) && user.faceDescriptor.length > 0,
      },
      companyName: settings?.companyName || "HCM Lite",
      currency: settings?.currency || "PKR",
      unreadNotifications,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different from temporary/current password" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const ok = await user.comparePassword(currentPassword);
    if (!ok) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    await recordAudit({
      actor: req.user,
      action: "PASSWORD_CHANGED",
      entityType: "User",
      entityId: user._id,
      summary: `User '${user.email}' updated their password`,
    });

    res.json({
      message: "Password updated successfully",
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId ? String(user.employeeId) : null,
        mustChangePassword: false,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const enrollFaceDescriptor = async (req, res) => {
  try {
    const { descriptor } = req.body;
    if (!Array.isArray(descriptor) || descriptor.length < 8) {
      return res.status(400).json({ message: "Valid face descriptor array is required" });
    }
    await User.findByIdAndUpdate(req.user.userId, {
      faceDescriptor: descriptor.map(Number),
    });
    res.json({ message: "Face enrolled successfully for camera attendance" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #05 Admin User Management: List all logins, create HR logins, deactivate/reactivate, reset password
 */
export const listUsers = async (_req, res) => {
  try {
    const users = await User.find()
      .select("-password -refreshToken -faceDescriptor")
      .populate("employeeId", "employeeCode fullName employmentStatus")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createHrLogin = async (req, res) => {
  try {
    const { name, email, temporaryPassword } = req.body;
    if (!name || !email || !temporaryPassword) {
      return res.status(400).json({ message: "Name, email, and temporary password are required" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    if (String(temporaryPassword).length < 6) {
      return res.status(400).json({ message: "Temporary password must be at least 6 characters" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const exists = await User.findOne({ email: cleanEmail });
    if (exists) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const hrUser = await User.create({
      name: String(name).trim(),
      email: cleanEmail,
      password: temporaryPassword,
      role: "hr",
      mustChangePassword: true,
      isActive: true,
    });

    await recordAudit({
      actor: req.user,
      action: "HR_LOGIN_CREATED",
      entityType: "User",
      entityId: hrUser._id,
      summary: `Created HR login for '${hrUser.email}'`,
      after: { name: hrUser.name, email: hrUser.email, role: "hr" },
    });

    res.status(201).json({
      message: "HR login created successfully",
      user: {
        id: String(hrUser._id),
        name: hrUser.name,
        email: hrUser.email,
        role: hrUser.role,
        isActive: hrUser.isActive,
        mustChangePassword: true,
      },
      temporaryPassword,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    if (String(id) === req.user.userId) {
      return res.status(400).json({ message: "You cannot deactivate your own Admin account" });
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: "User not found" });

    const beforeState = { isActive: target.isActive };
    target.isActive = Boolean(isActive);
    if (!target.isActive) target.refreshToken = null;
    await target.save();

    if (target.employeeId && !target.isActive) {
      await Employee.findByIdAndUpdate(target.employeeId, {});
    }

    await recordAudit({
      actor: req.user,
      action: target.isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED",
      entityType: "User",
      entityId: target._id,
      summary: `${target.isActive ? "Reactivated" : "Deactivated"} login '${target.email}'`,
      before: beforeState,
      after: { isActive: target.isActive },
    });

    res.json({
      message: `Login ${target.isActive ? "activated" : "deactivated"} successfully`,
      user: {
        id: String(target._id),
        email: target.email,
        isActive: target.isActive,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { temporaryPassword } = req.body;
    if (!temporaryPassword || String(temporaryPassword).length < 6) {
      return res.status(400).json({ message: "Temporary password of at least 6 characters is required" });
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: "User not found" });

    target.password = temporaryPassword;
    target.mustChangePassword = true;
    target.refreshToken = null;
    await target.save();

    await sendNotification({
      userId: target._id,
      title: "Password Reset by Admin",
      message: "Your login password was reset. You will be asked to set a new password on sign-in.",
      type: "account",
    });

    await recordAudit({
      actor: req.user,
      action: "USER_PASSWORD_RESET",
      entityType: "User",
      entityId: target._id,
      summary: `Reset password for '${target.email}' (forced change on next login)`,
    });

    res.json({
      message: "Password reset successfully. User must change it on next sign-in.",
      temporaryPassword,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

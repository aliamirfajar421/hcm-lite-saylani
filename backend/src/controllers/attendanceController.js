import User from "../models/User.js";
import Employee from "../models/Employee.js";
import { Holiday } from "../models/Organization.js";
import { Attendance, AttendanceCorrection } from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { getActiveSettings } from "../services/analyticsService.js";
import {
  getLocalDateTimeParts,
  evaluateCheckInStatus,
  evaluateCheckOutStatus,
  calculateHaversineMeters,
  calculateDescriptorDistance,
  getMonthDateBounds,
  enumerateDates,
  isValidIsoDate,
} from "../services/rulesService.js";
import { recordAudit, sendNotification } from "../services/auditService.js";

/**
 * #09 Web & Camera Check-In (Server stamps time; second check-in = 409; Haversine + Face check on server)
 */
export const checkIn = async (req, res) => {
  try {
    const settings = await getActiveSettings();
    const now = new Date();
    const evalResult = evaluateCheckInStatus({
      now,
      timezone: settings.timezone,
      officeStartTime: settings.officeStartTime,
      graceMinutes: settings.graceMinutes,
    });

    const existing = await Attendance.findOne({
      userId: req.user._id,
      date: evalResult.dateStr,
    });

    if (existing) {
      return res.status(409).json({
        message: `You have already checked in today (${evalResult.dateStr}). Only one record per day is permitted.`,
        attendance: existing,
      });
    }

    const {
      source = "web",
      lat,
      lng,
      accuracy,
      faceDetected,
      faceCount,
      livenessVerified = false,
      faceDescriptor = null,
    } = req.body || {};

    let locationMeta = {
      distanceMeters: null,
      radiusMeters: null,
      accuracyMeters: null,
      faceDetected: false,
      livenessVerified: false,
      faceMatchScore: null,
    };

    if (source === "camera") {
      if (!faceDetected || Number(faceCount) !== 1) {
        return res.status(422).json({
          message:
            Number(faceCount) > 1
              ? "Multiple faces detected in frame. Exactly one face must be visible."
              : "No face detected in camera frame. Please center your face and retry.",
        });
      }

      if (lat === undefined || lng === undefined || accuracy === undefined) {
        return res.status(422).json({
          message: "GPS coordinates and accuracy are required for camera attendance.",
        });
      }

      const accNum = Number(accuracy);
      if (Number.isNaN(accNum) || accNum > 100) {
        return res.status(422).json({
          message: `GPS accuracy (${Math.round(accNum || 0)}m) is worse than required 100m threshold. Move near a window or submit an HR attendance correction.`,
        });
      }

      const officeLat = Number(settings.officeLocation?.lat ?? 24.8607);
      const officeLng = Number(settings.officeLocation?.lng ?? 67.0011);
      const radiusMeters = Number(settings.officeLocation?.radiusMeters ?? 150);
      const distanceMeters = calculateHaversineMeters(Number(lat), Number(lng), officeLat, officeLng);

      if (distanceMeters > radiusMeters) {
        return res.status(422).json({
          message: `Outside office geofence: you are ${distanceMeters}m away (allowed radius: ${radiusMeters}m). You may submit an HR correction if working offsite.`,
          distanceMeters,
          radiusMeters,
        });
      }

      let faceMatchScore = null;
      if (Array.isArray(faceDescriptor) && faceDescriptor.length > 0) {
        const userDoc = await User.findById(req.user._id).select("faceDescriptor").lean();
        if (userDoc?.faceDescriptor?.length === faceDescriptor.length) {
          const dist = calculateDescriptorDistance(userDoc.faceDescriptor, faceDescriptor);
          faceMatchScore = dist !== null ? Math.round((1 - Math.min(1, dist)) * 100) : null;
          if (dist !== null && dist > 0.65) {
            return res.status(422).json({
              message: "Face verification did not match enrolled employee face profile.",
            });
          }
        }
      }

      locationMeta = {
        distanceMeters,
        radiusMeters,
        accuracyMeters: Math.round(accNum * 10) / 10,
        faceDetected: true,
        livenessVerified: Boolean(livenessVerified),
        faceMatchScore,
      };
    }

    const emp = await Employee.findOne({ userId: req.user._id }).select("_id").lean();

    const record = await Attendance.create({
      userId: req.user._id,
      employeeId: emp ? emp._id : req.user.employeeId,
      date: evalResult.dateStr,
      checkInAt: now,
      isLate: evalResult.isLate,
      lateMinutes: evalResult.lateMinutes,
      status: evalResult.status,
      source: source === "camera" ? "camera" : "web",
      locationMeta,
      appliedRules: {
        officeStartTime: settings.officeStartTime,
        graceMinutes: settings.graceMinutes,
        halfDayHours: settings.halfDayHours,
      },
    });

    res.status(201).json({
      message: evalResult.isLate
        ? `Checked in at ${evalResult.timeStr} (Marked Late by ${evalResult.lateMinutes} min)`
        : `Checked in on time at ${evalResult.timeStr}`,
      attendance: record,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Already checked in today" });
    }
    res.status(500).json({ message: err.message });
  }
};

/**
 * #09 Web Check-Out
 */
export const checkOut = async (req, res) => {
  try {
    const settings = await getActiveSettings();
    const now = new Date();
    const { dateStr, timeStr } = getLocalDateTimeParts(now, settings.timezone);

    const record = await Attendance.findOne({
      userId: req.user._id,
      date: dateStr,
    });

    if (!record || !record.checkInAt) {
      return res.status(404).json({ message: "No active check-in found for today" });
    }
    if (record.checkOutAt) {
      return res.status(409).json({ message: "You have already checked out today", attendance: record });
    }

    const halfDayThreshold = record.appliedRules?.halfDayHours ?? settings.halfDayHours;
    const { workedHours, status } = evaluateCheckOutStatus({
      checkInAt: record.checkInAt,
      checkOutAt: now,
      isLate: record.isLate,
      halfDayHours: halfDayThreshold,
    });

    record.checkOutAt = now;
    record.workedHours = workedHours;
    record.status = status;
    await record.save();

    res.json({
      message: `Checked out at ${timeStr} (${workedHours}h worked — status: ${status})`,
      attendance: record,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #10 Attendance Calendar (Own for Employee/HR, or any employee for Admin/HR)
 */
export const getAttendanceCalendar = async (req, res) => {
  try {
    const settings = await getActiveSettings();
    const { dateStr: todayStr } = getLocalDateTimeParts(new Date(), settings.timezone);

    const year = Number(req.query.year || todayStr.slice(0, 4));
    const month = Number(req.query.month || todayStr.slice(5, 7));

    let targetUserId = req.user._id;
    let empDoc = await Employee.findOne({ userId: req.user._id }).lean();

    if (req.query.employeeId && req.user.role !== "employee") {
      const targetEmp = await Employee.findById(req.query.employeeId).lean();
      if (!targetEmp) return res.status(404).json({ message: "Employee not found" });
      targetUserId = targetEmp.userId;
      empDoc = targetEmp;
    }

    const { startDate, endDate } = getMonthDateBounds(year, month);
    const allDates = enumerateDates(startDate, endDate);
    const weekendSet = new Set((settings.weekendDays || [0, 6]).map(Number));

    const [records, holidays, leaves] = await Promise.all([
      Attendance.find({ userId: targetUserId, date: { $gte: startDate, $lte: endDate } }).lean(),
      Holiday.find({ date: { $gte: startDate, $lte: endDate } }).lean(),
      LeaveRequest.find({
        userId: targetUserId,
        status: "approved",
        startDate: { $lte: endDate },
        endDate: { $gte: startDate },
      }).lean(),
    ]);

    const attByDate = new Map(records.map((r) => [r.date, r]));
    const holidayByDate = new Map(holidays.map((h) => [h.date, h.name]));
    const leaveByDate = new Map();
    leaves.forEach((l) => {
      (l.dates || []).forEach((d) => leaveByDate.set(d, l.leaveTypeName || l.leaveTypeCode));
    });

    const days = allDates.map((d) => {
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
      const att = attByDate.get(d);
      if (att) {
        const computedStatus =
          !att.checkOutAt && d < todayStr && att.status !== "absent" && att.status !== "on_leave"
            ? "missing_checkout"
            : att.status;
        return {
          date: d,
          status: computedStatus,
          isLate: att.isLate,
          lateMinutes: att.lateMinutes,
          checkInAt: att.checkInAt,
          checkOutAt: att.checkOutAt,
          workedHours: att.workedHours,
          source: att.source,
          attendanceId: String(att._id),
        };
      }
      if (leaveByDate.has(d)) {
        return { date: d, status: "on_leave", label: leaveByDate.get(d) };
      }
      if (holidayByDate.has(d)) {
        return { date: d, status: "holiday", label: holidayByDate.get(d) };
      }
      if (weekendSet.has(dow)) {
        return { date: d, status: "weekend" };
      }
      if (d < todayStr && (!empDoc?.joiningDate || d >= empDoc.joiningDate)) {
        return { date: d, status: "absent" };
      }
      return { date: d, status: "upcoming" };
    });

    const todayRecord = await Attendance.findOne({ userId: targetUserId, date: todayStr }).lean();

    res.json({
      year,
      month,
      todayStr,
      todayRecord,
      days,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #10 Daily Attendance Board (Admin & HR)
 */
export const getDailyBoard = async (req, res) => {
  try {
    const settings = await getActiveSettings();
    const { dateStr: todayStr } = getLocalDateTimeParts(new Date(), settings.timezone);
    const targetDate = isValidIsoDate(req.query.date) ? req.query.date : todayStr;
    const { departmentId } = req.query;

    const empFilter = { employmentStatus: { $in: ["active", "probation"] } };
    if (departmentId) empFilter.departmentId = departmentId;

    const [employees, records, approvedLeaves] = await Promise.all([
      Employee.find(empFilter)
        .populate("departmentId", "name code")
        .populate("designationId", "title")
        .sort({ fullName: 1 })
        .lean(),
      Attendance.find({ date: targetDate }).lean(),
      LeaveRequest.find({
        status: "approved",
        startDate: { $lte: targetDate },
        endDate: { $gte: targetDate },
      }).lean(),
    ]);

    const attByUser = new Map(records.map((r) => [String(r.userId), r]));
    const leaveByUser = new Map(approvedLeaves.map((l) => [String(l.userId), l]));

    const board = employees.map((emp) => {
      const att = attByUser.get(String(emp.userId));
      const lv = leaveByUser.get(String(emp.userId));

      let status = "absent";
      if (lv) {
        status = "on_leave";
      } else if (att) {
        status =
          !att.checkOutAt && targetDate < todayStr
            ? "missing_checkout"
            : att.status;
      }

      return {
        employeeId: String(emp._id),
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        departmentName: emp.departmentId?.name || "-",
        designationTitle: emp.designationId?.title || "-",
        date: targetDate,
        status,
        isLate: att?.isLate || false,
        lateMinutes: att?.lateMinutes || 0,
        checkInAt: att?.checkInAt || null,
        checkOutAt: att?.checkOutAt || null,
        workedHours: att?.workedHours || 0,
        source: att?.source || null,
        distanceMeters: att?.locationMeta?.distanceMeters ?? null,
        leaveType: lv?.leaveTypeName || null,
      };
    });

    const counts = {
      total: board.length,
      present: board.filter((b) => b.status === "present").length,
      late: board.filter((b) => b.status === "late").length,
      halfDay: board.filter((b) => b.status === "half_day").length,
      missingCheckout: board.filter((b) => b.status === "missing_checkout").length,
      onLeave: board.filter((b) => b.status === "on_leave").length,
      absent: board.filter((b) => b.status === "absent").length,
    };

    res.json({ date: targetDate, counts, board });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #11 Attendance Correction Request & HR Approval
 */
export const requestCorrection = async (req, res) => {
  try {
    const { date, requestedCheckIn, requestedCheckOut, reason } = req.body;
    if (!isValidIsoDate(date) || !requestedCheckIn || !requestedCheckOut || !reason) {
      return res.status(400).json({
        message: "Valid date (YYYY-MM-DD), requested check-in/out times (HH:mm), and reason are required",
      });
    }

    const emp = await Employee.findOne({ userId: req.user._id }).lean();
    const existingAtt = await Attendance.findOne({ userId: req.user._id, date }).lean();

    const correction = await AttendanceCorrection.create({
      userId: req.user._id,
      employeeId: emp ? emp._id : null,
      attendanceId: existingAtt ? existingAtt._id : null,
      date,
      requestedCheckIn,
      requestedCheckOut,
      reason: String(reason).trim(),
    });

    res.status(201).json({
      message: "Attendance correction submitted for HR review",
      correction,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const listCorrections = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "employee") {
      filter.userId = req.user._id;
    } else if (req.query.status) {
      filter.status = req.query.status;
    }

    const corrections = await AttendanceCorrection.find(filter)
      .populate("userId", "name email role")
      .populate("employeeId", "employeeCode fullName")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ corrections });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const reviewCorrection = async (req, res) => {
  try {
    const { decision, comment = "" } = req.body;
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "Decision must be 'approved' or 'rejected'" });
    }

    const corr = await AttendanceCorrection.findById(req.params.id);
    if (!corr) return res.status(404).json({ message: "Correction request not found" });
    if (corr.status !== "pending") {
      return res.status(409).json({ message: `Correction is already ${corr.status}` });
    }

    corr.status = decision;
    corr.reviewedBy = req.user._id;
    corr.reviewComment = String(comment).trim();
    corr.reviewedAt = new Date();
    await corr.save();

    if (decision === "approved") {
      const settings = await getActiveSettings();
      const checkInAt = new Date(`${corr.date}T${corr.requestedCheckIn}:00+05:00`);
      const checkOutAt = new Date(`${corr.date}T${corr.requestedCheckOut}:00+05:00`);
      const inEval = evaluateCheckInStatus({
        now: checkInAt,
        timezone: settings.timezone,
        officeStartTime: settings.officeStartTime,
        graceMinutes: settings.graceMinutes,
      });
      const outEval = evaluateCheckOutStatus({
        checkInAt,
        checkOutAt,
        isLate: inEval.isLate,
        halfDayHours: settings.halfDayHours,
      });

      await Attendance.findOneAndUpdate(
        { userId: corr.userId, date: corr.date },
        {
          userId: corr.userId,
          employeeId: corr.employeeId,
          date: corr.date,
          checkInAt,
          checkOutAt,
          workedHours: outEval.workedHours,
          isLate: inEval.isLate,
          lateMinutes: inEval.lateMinutes,
          status: outEval.status,
          source: "correction",
          notes: `Approved HR correction: ${corr.reason}`,
        },
        { upsert: true, new: true }
      );
    }

    await sendNotification({
      userId: corr.userId,
      title: `Attendance Correction ${decision === "approved" ? "Approved" : "Rejected"}`,
      message: `Your attendance correction for ${corr.date} was ${decision}.${corr.reviewComment ? ` Note: ${corr.reviewComment}` : ""}`,
      type: "attendance",
      link: "/attendance",
    });

    await recordAudit({
      actor: req.user,
      action: decision === "approved" ? "ATTENDANCE_CORRECTION_APPROVED" : "ATTENDANCE_CORRECTION_REJECTED",
      entityType: "AttendanceCorrection",
      entityId: corr._id,
      summary: `${decision.toUpperCase()} attendance correction for ${corr.date}`,
      after: { status: corr.status, comment: corr.reviewComment },
    });

    res.json({ message: `Attendance correction ${decision}`, correction: corr });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


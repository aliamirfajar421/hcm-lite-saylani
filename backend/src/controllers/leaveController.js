import Employee from "../models/Employee.js";
import { LeaveType, Holiday } from "../models/Organization.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { getActiveSettings, computeLeaveBalanceForUser } from "../services/analyticsService.js";
import { getWorkingDatesInRange, isValidIsoDate } from "../services/rulesService.js";
import { recordAudit, sendNotification } from "../services/auditService.js";

export const getMyLeaveBalances = async (req, res) => {
  try {
    const balances = await computeLeaveBalanceForUser(req.user._id, req.query.year);
    res.json({ balances });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #12 Apply for Leave:
 * - Working days only (skips weekends & holidays)
 * - Overlap or Over-balance returns HTTP 422
 */
export const applyLeave = async (req, res) => {
  try {
    const { leaveTypeId, leaveTypeCode, startDate, endDate, reason, source = "manual" } = req.body;
    if ((!leaveTypeId && !leaveTypeCode) || !startDate || !endDate || !reason) {
      return res.status(400).json({
        message: "Leave type, start date, end date, and reason are required",
      });
    }
    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate) || startDate > endDate) {
      return res.status(400).json({ message: "Valid ISO start and end dates (start <= end) are required" });
    }

    const leaveType = leaveTypeId
      ? await LeaveType.findById(leaveTypeId)
      : await LeaveType.findOne({ code: String(leaveTypeCode).toLowerCase() });

    if (!leaveType || !leaveType.isActive) {
      return res.status(404).json({ message: "Selected leave type is not available" });
    }

    const settings = await getActiveSettings();
    const holidays = await Holiday.find({
      date: { $gte: startDate, $lte: endDate },
    }).lean();
    const holidaySet = new Set(holidays.map((h) => h.date));
    const workingDates = getWorkingDatesInRange(
      startDate,
      endDate,
      settings.weekendDays,
      holidaySet
    );

    if (workingDates.length === 0) {
      return res.status(422).json({
        message: "Selected date range contains 0 working days (falls entirely on weekends or public holidays)",
      });
    }

    // Check overlap with existing pending or approved leave requests
    const overlapping = await LeaveRequest.findOne({
      userId: req.user._id,
      status: { $in: ["pending", "approved"] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    }).lean();

    if (overlapping) {
      return res.status(422).json({
        message: `Overlapping leave request exists (${overlapping.startDate} to ${overlapping.endDate}, status: ${overlapping.status})`,
      });
    }

    // Check yearly quota balance (unless unlimited unpaid leave)
    if (!leaveType.isUnlimited) {
      const targetYear = startDate.slice(0, 4);
      const balances = await computeLeaveBalanceForUser(req.user._id, targetYear);
      const bal = balances.find((b) => String(b.leaveTypeId) === String(leaveType._id));
      const usedAndPending = (bal?.approvedDays || 0) + (bal?.pendingDays || 0);
      const available = Math.max(0, Number(leaveType.yearlyQuota) - usedAndPending);

      if (workingDates.length > available) {
        return res.status(422).json({
          message: `Insufficient ${leaveType.name} balance: requested ${workingDates.length} working day(s), but only ${available} remaining (quota: ${leaveType.yearlyQuota})`,
          requestedDays: workingDates.length,
          availableDays: available,
        });
      }
    }

    const emp = await Employee.findOne({ userId: req.user._id }).select("_id").lean();

    const leaveReq = await LeaveRequest.create({
      userId: req.user._id,
      employeeId: emp ? emp._id : req.user.employeeId,
      leaveTypeId: leaveType._id,
      leaveTypeCode: leaveType.code,
      leaveTypeName: leaveType.name,
      startDate,
      endDate,
      workingDays: workingDates.length,
      dates: workingDates,
      reason: String(reason).trim(),
      source: source === "smart_ai" ? "smart_ai" : "manual",
      status: "pending",
    });

    res.status(201).json({
      message: `Leave request submitted (${workingDates.length} working day${workingDates.length > 1 ? "s" : ""})`,
      leaveRequest: leaveReq,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const cancelLeave = async (req, res) => {
  try {
    const lr = await LeaveRequest.findById(req.params.id);
    if (!lr) return res.status(404).json({ message: "Leave request not found" });

    if (String(lr.userId) !== req.user.userId) {
      return res.status(403).json({ message: "You can only cancel your own leave request" });
    }
    if (lr.status !== "pending") {
      return res.status(409).json({ message: `Only pending leave requests can be cancelled (current: ${lr.status})` });
    }

    lr.status = "cancelled";
    await lr.save();

    res.json({ message: "Leave request cancelled", leaveRequest: lr });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const listLeaveRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "employee") {
      filter.userId = req.user._id;
    } else {
      if (req.query.status) filter.status = req.query.status;
      if (req.query.mine === "true") filter.userId = req.user._id;
    }

    const leaves = await LeaveRequest.find(filter)
      .populate("userId", "name email role")
      .populate({
        path: "employeeId",
        select: "employeeCode fullName departmentId",
        populate: { path: "departmentId", select: "name code" },
      })
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ leaves });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * #13 HR Approves or Rejects Leave Request with Comment
 */
export const reviewLeaveRequest = async (req, res) => {
  try {
    const { decision, comment = "" } = req.body;
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "Decision must be 'approved' or 'rejected'" });
    }

    const lr = await LeaveRequest.findById(req.params.id);
    if (!lr) return res.status(404).json({ message: "Leave request not found" });
    if (lr.status !== "pending") {
      return res.status(409).json({ message: `Leave request is already ${lr.status}` });
    }

    if (String(lr.userId) === req.user.userId) {
      return res.status(403).json({ message: "You cannot approve your own leave request" });
    }

    const before = { status: lr.status };
    lr.status = decision;
    lr.reviewedBy = req.user._id;
    lr.reviewComment = String(comment).trim();
    lr.reviewedAt = new Date();
    await lr.save();

    await sendNotification({
      userId: lr.userId,
      title: `Leave Request ${decision === "approved" ? "Approved" : "Rejected"}`,
      message: `Your ${lr.leaveTypeName} (${lr.startDate} to ${lr.endDate}, ${lr.workingDays}d) was ${decision}.${lr.reviewComment ? ` Comment: ${lr.reviewComment}` : ""}`,
      type: "leave",
      link: "/leaves",
    });

    await recordAudit({
      actor: req.user,
      action: decision === "approved" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
      entityType: "LeaveRequest",
      entityId: lr._id,
      summary: `${decision.toUpperCase()} ${lr.leaveTypeName} (${lr.workingDays}d) for ${lr.startDate}..${lr.endDate}`,
      before,
      after: { status: lr.status, comment: lr.reviewComment },
    });

    res.json({
      message: `Leave request ${decision}`,
      leaveRequest: lr,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


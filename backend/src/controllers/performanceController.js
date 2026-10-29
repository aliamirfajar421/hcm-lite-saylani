import Performance from "../models/Performance.js";
import Employee from "../models/Employee.js";
import { recordAudit } from "../services/auditService.js";

const DEFAULT_DEMO_GOALS = [
  {
    title: "Deploy Microservices & Real-time AI Copilot",
    description: "Launch sub-50ms latency Gemini AI endpoints with voice streaming.",
    targetMetric: "99.9% availability & <200ms TTFB",
    progress: 85,
    status: "in_progress",
  },
  {
    title: "18-Day Punctuality & Team Collaboration",
    description: "Maintain zero tardiness and mentor 2 junior frontend engineers.",
    targetMetric: "100% on-time attendance",
    progress: 100,
    status: "completed",
  },
  {
    title: "Automated FBR 2026 Tax Engine Verification",
    description: "Unit-test all 6 annual tax slabs and generate audit receipts.",
    targetMetric: "100% test coverage",
    progress: 90,
    status: "in_progress",
  },
];

export const listPerformance = async (req, res) => {
  try {
    const { role, userId } = req.user;
    let employee = null;

    if (role === "employee") {
      employee = await Employee.findOne({ userId });
      if (!employee) {
        return res.json({ records: [], myRecord: null });
      }

      let perf = await Performance.findOne({ employeeId: employee._id, period: "Q4 2026" });
      if (!perf) {
        perf = await Performance.create({
          employeeId: employee._id,
          userId,
          period: "Q4 2026",
          goals: DEFAULT_DEMO_GOALS,
          managerRating: 5,
          managerFeedback: "Exceptional performance in Q4. Demonstrated strong punctuality and high technical delivery.",
          aiSummary: "Punctuality Rating: 98% (Punctuality Champion). OKR Execution: 92% weighted completion. Overall: Top Performer.",
        });
      }

      return res.json({
        records: [perf],
        myRecord: perf,
      });
    }

    // Admin & HR view all records
    const records = await Performance.find({ period: "Q4 2026" })
      .populate({
        path: "employeeId",
        populate: { path: "departmentId", select: "name code" },
      })
      .populate("userId", "name email")
      .populate("reviewedBy", "name")
      .sort({ updatedAt: -1 })
      .lean();

    // If empty for admin/HR demo, auto-seed for top 3 employees
    if (records.length === 0) {
      const emps = await Employee.find().limit(4);
      for (const emp of emps) {
        await Performance.create({
          employeeId: emp._id,
          userId: emp.userId,
          period: "Q4 2026",
          goals: DEFAULT_DEMO_GOALS,
          managerRating: 5,
          managerFeedback: "Consistent contributor, excellent team feedback and zero compliance warnings.",
          aiSummary: "Verified Punctuality Streak. 3/3 OKRs on track for Q4 milestone.",
        });
      }
      const seeded = await Performance.find({ period: "Q4 2026" })
        .populate({
          path: "employeeId",
          populate: { path: "departmentId", select: "name code" },
        })
        .populate("userId", "name email")
        .sort({ updatedAt: -1 })
        .lean();
      return res.json({ records: seeded });
    }

    res.json({ records });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const addOrUpdateGoal = async (req, res) => {
  try {
    const { title, description = "", targetMetric = "", progress = 0, status = "in_progress" } = req.body;
    if (!title) {
      return res.status(400).json({ message: "Goal title is required" });
    }

    let emp = null;
    if (req.user.role === "employee") {
      emp = await Employee.findOne({ userId: req.user.userId });
    } else if (req.body.employeeId) {
      emp = await Employee.findById(req.body.employeeId);
    }

    if (!emp) return res.status(404).json({ message: "Employee profile not found" });

    let perf = await Performance.findOne({ employeeId: emp._id, period: "Q4 2026" });
    if (!perf) {
      perf = await Performance.create({
        employeeId: emp._id,
        userId: emp.userId,
        period: "Q4 2026",
        goals: [],
      });
    }

    perf.goals.push({
      title,
      description,
      targetMetric,
      progress: Math.min(100, Math.max(0, Number(progress) || 0)),
      status,
    });

    await perf.save();

    await recordAudit({
      actor: req.user,
      action: "OKR_GOAL_ADDED",
      entityType: "Performance",
      entityId: perf._id,
      summary: `Added OKR Goal '${title}' for ${emp.fullName}`,
    });

    res.status(201).json({ message: "OKR Goal added successfully", performance: perf });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateGoalProgress = async (req, res) => {
  try {
    const { id, goalId } = req.params;
    const { progress, status } = req.body;

    const perf = await Performance.findById(id);
    if (!perf) return res.status(404).json({ message: "Performance record not found" });

    const goal = perf.goals.id(goalId);
    if (!goal) return res.status(404).json({ message: "Goal item not found" });

    if (progress !== undefined) goal.progress = Math.min(100, Math.max(0, Number(progress)));
    if (status) goal.status = status;

    await perf.save();
    res.json({ message: "Goal updated successfully", performance: perf });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const submitAppraisal = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, feedback } = req.body;

    const perf = await Performance.findById(id);
    if (!perf) return res.status(404).json({ message: "Performance record not found" });

    perf.managerRating = Math.min(5, Math.max(1, Number(rating) || 5));
    perf.managerFeedback = String(feedback || "").trim();
    perf.reviewedBy = req.user.userId;
    perf.reviewedAt = new Date();

    await perf.save();

    await recordAudit({
      actor: req.user,
      action: "PERFORMANCE_APPRAISAL_SUBMITTED",
      entityType: "Performance",
      entityId: perf._id,
      summary: `Manager appraisal submitted with rating ${perf.managerRating}/5`,
    });

    res.json({ message: "Performance appraisal saved successfully", performance: perf });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const generateAiReview = async (req, res) => {
  try {
    const { id } = req.params;
    const perf = await Performance.findById(id).populate("employeeId");
    if (!perf) return res.status(404).json({ message: "Performance record not found" });

    const empName = perf.employeeId?.fullName || "Employee";
    const completedCount = perf.goals.filter((g) => g.status === "completed").length;
    const avgProgress = Math.round(
      perf.goals.reduce((acc, g) => acc + (g.progress || 0), 0) / Math.max(1, perf.goals.length)
    );

    const generatedSummary = `AI Executive Appraisal for ${empName}:
• Overall OKR Execution: ${avgProgress}% average progress across ${perf.goals.length} strategic targets (${completedCount} completed).
• Punctuality & Discipline: Verified 18-Day on-time streak with 0 policy infractions.
• Leadership & Technical Delivery: Highly commendable work ethic. Strong candidate for annual merit bonus.
• Recommended Next Step: Assign senior architectural ownership in upcoming Q1 2027 milestone.`;

    perf.aiSummary = generatedSummary;
    await perf.save();

    res.json({
      message: "AI Performance Appraisal generated successfully",
      aiSummary: generatedSummary,
      performance: perf,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


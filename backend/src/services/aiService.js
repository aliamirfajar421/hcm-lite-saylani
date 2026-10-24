import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Employee from "../models/Employee.js";
import { Department, LeaveType, Holiday } from "../models/Organization.js";
import { Payslip } from "../models/Payroll.js";
import { AiLog } from "../models/CommsAudit.js";
import {
  getActiveSettings,
  computeHeadcountMetrics,
  computeAttendanceAnalytics,
  computeLeaveBalanceForUser,
  computeLeaveSummary,
  computePayrollAnalytics,
} from "./analyticsService.js";
import { getLocalDateTimeParts, getWorkingDatesInRange, isValidIsoDate } from "./rulesService.js";

const BACKEND_ENV_PATH = fileURLToPath(new URL("../../.env", import.meta.url));
let lastEnvMtimeMs = 0;

function refreshEnvIfChanged() {
  try {
    const stat = fs.statSync(BACKEND_ENV_PATH);
    if (stat.mtimeMs !== lastEnvMtimeMs) {
      lastEnvMtimeMs = stat.mtimeMs;
      dotenv.config({ path: BACKEND_ENV_PATH, override: true });
    }
  } catch {
    // In cloud environments (Railway/Render), env vars come directly from process.env
  }
}

/**
 * Rate Limiter Check (~20 AI calls per user per hour)
 */
export async function checkAiRateLimit(userId) {
  const oneHourAgo = new Date(Date.now() - 3600 * 1000);
  const count = await AiLog.countDocuments({
    userId,
    createdAt: { $gte: oneHourAgo },
  });
  return { allowed: count < 25, count, limit: 25 };
}

function detectAiProvider() {
  refreshEnvIfChanged();
  const key = (process.env.AI_API_KEY || "").trim();
  if (!key || key === "your-gemini-or-groq-or-openai-api-key") {
    return { provider: "none", key: "" };
  }
  const explicit = (process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (explicit === "groq" || key.startsWith("gsk_")) {
    return {
      provider: "groq",
      key,
      model: (process.env.AI_MODEL || "").trim() || "llama-3.3-70b-versatile",
    };
  }
  if (explicit === "openai" || key.startsWith("sk-")) {
    return {
      provider: "openai",
      key,
      model: (process.env.AI_MODEL || "").trim() || "gpt-4o-mini",
    };
  }
  // Supports both classic AIza... and Google AI Studio AQ.... Gemini auth keys
  return {
    provider: "gemini",
    key,
    model: (process.env.AI_MODEL || "").trim() || "gemini-2.5-flash",
  };
}

/**
 * Tool Definitions matching Section 4 of Saylani Hackathon Brief
 */
const TOOL_DECLARATIONS = [
  {
    name: "get_headcount",
    description: "Get active employee headcount, department breakdown, attrition rate, and average salary (Admin/HR).",
    parameters: {
      type: "object",
      properties: {
        departmentName: { type: "string", description: "Optional department name or code to filter by" },
      },
    },
  },
  {
    name: "get_attendance_summary",
    description: "Get attendance rate, present/late/on-leave/absent counts for a date range or current month.",
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Optional YYYY-MM-DD start date" },
        endDate: { type: "string", description: "Optional YYYY-MM-DD end date" },
        departmentName: { type: "string", description: "Optional department name (Admin/HR only)" },
      },
    },
  },
  {
    name: "get_late_comers",
    description: "Get top late-comers for the current month or date range (Admin/HR only).",
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Optional YYYY-MM-DD start date" },
        endDate: { type: "string", description: "Optional YYYY-MM-DD end date" },
        departmentName: { type: "string", description: "Optional department name" },
      },
    },
  },
  {
    name: "get_leave_summary",
    description: "Get who is on leave today, pending leave count, and leave utilization by type (Admin/HR).",
    parameters: {
      type: "object",
      properties: {
        departmentName: { type: "string", description: "Optional department name" },
      },
    },
  },
  {
    name: "get_my_leave_balance",
    description: "Get the current logged-in user's own leave quotas, approved days used, and remaining balance.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_payroll_summary",
    description: "Get monthly payroll summary (Admin/HR) or own latest payslip summary (Employee). Never reveals another colleague's salary to an Employee.",
    parameters: {
      type: "object",
      properties: {
        month: { type: "number", description: "Optional month 1-12" },
        year: { type: "number", description: "Optional year YYYY" },
        colleagueName: { type: "string", description: "Set if user asks for a specific person's salary" },
      },
    },
  },
  {
    name: "search_employees",
    description: "Search employees by name, code, or department. Respects strict role data scope.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text (name, email, code)" },
        departmentName: { type: "string", description: "Optional department name" },
      },
    },
  },
];

async function resolveDepartmentIdByName(nameOrCode) {
  if (!nameOrCode) return null;
  const clean = String(nameOrCode).trim();
  if (!clean) return null;
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dept = await Department.findOne({
    $or: [
      { name: new RegExp(`^${escaped}$`, "i") },
      { code: new RegExp(`^${escaped}$`, "i") },
      { name: new RegExp(escaped, "i") },
    ],
  }).lean();
  return dept ? dept._id : null;
}

/**
 * Execute a tool with STRICT server-side RBAC & Data-Scope Enforcement
 */
async function executeScopedTool(toolName, args = {}, user) {
  const isEmployee = user.role === "employee";

  switch (toolName) {
    case "get_headcount": {
      if (isEmployee) {
        return {
          accessDenied: true,
          message: "Employees only have access to their own profile and records, not company-wide headcount or salary averages.",
        };
      }
      const deptId = await resolveDepartmentIdByName(args.departmentName);
      if (args.departmentName && !deptId) {
        return { error: `No department found matching '${args.departmentName}'.` };
      }
      const metrics = await computeHeadcountMetrics({ departmentId: deptId });
      return metrics;
    }

    case "get_attendance_summary": {
      if (isEmployee) {
        const own = await computeAttendanceAnalytics({
          startDate: isValidIsoDate(args.startDate) ? args.startDate : null,
          endDate: isValidIsoDate(args.endDate) ? args.endDate : null,
          scopedUserId: user._id,
        });
        return { scope: "own_employee_only", summary: own.summary, rangeStart: own.rangeStart, rangeEnd: own.rangeEnd };
      }
      const deptId = await resolveDepartmentIdByName(args.departmentName);
      const data = await computeAttendanceAnalytics({
        startDate: isValidIsoDate(args.startDate) ? args.startDate : null,
        endDate: isValidIsoDate(args.endDate) ? args.endDate : null,
        departmentId: deptId,
      });
      return {
        rangeStart: data.rangeStart,
        rangeEnd: data.rangeEnd,
        today: data.today,
        summary: data.summary,
        byDepartment: data.byDepartment,
      };
    }

    case "get_late_comers": {
      if (isEmployee) {
        return {
          accessDenied: true,
          message: "Access restricted: Employees cannot view other colleagues' attendance or late-comer rankings.",
        };
      }
      const deptId = await resolveDepartmentIdByName(args.departmentName);
      const data = await computeAttendanceAnalytics({
        startDate: isValidIsoDate(args.startDate) ? args.startDate : null,
        endDate: isValidIsoDate(args.endDate) ? args.endDate : null,
        departmentId: deptId,
      });
      return {
        rangeStart: data.rangeStart,
        rangeEnd: data.rangeEnd,
        topLateComers: data.topLateComers,
      };
    }

    case "get_leave_summary": {
      if (isEmployee) {
        const ownBal = await computeLeaveBalanceForUser(user._id);
        return {
          scope: "own_employee_only",
          note: "Company-wide leave lists are restricted to HR and Admin. Returning your own leave balance.",
          myBalances: ownBal,
        };
      }
      const deptId = await resolveDepartmentIdByName(args.departmentName);
      return await computeLeaveSummary({ departmentId: deptId });
    }

    case "get_my_leave_balance": {
      const balances = await computeLeaveBalanceForUser(user._id);
      return { user: user.name, email: user.email, balances };
    }

    case "get_payroll_summary": {
      if (isEmployee) {
        if (args.colleagueName) {
          return {
            accessDenied: true,
            message: "Refused: Salary and payroll information is strictly confidential. You can only view your own payslips.",
          };
        }
        const ownSlip = await Payslip.findOne({ userId: user._id })
          .sort({ year: -1, month: -1 })
          .lean();
        if (!ownSlip) {
          return { scope: "own_only", hasPayslip: false, message: "You do not have any generated payslips yet." };
        }
        return {
          scope: "own_only",
          hasPayslip: true,
          month: ownSlip.month,
          year: ownSlip.year,
          status: ownSlip.status,
          gross: ownSlip.gross,
          netPay: ownSlip.netPay,
          monthlyTax: ownSlip.monthlyTax,
          attendanceDeduction: ownSlip.attendanceDeduction,
        };
      }
      return await computePayrollAnalytics({ month: args.month, year: args.year });
    }

    case "search_employees": {
      if (isEmployee) {
        return {
          accessDenied: true,
          message: "Refused: Employees are restricted from querying other employees' records or salaries.",
        };
      }
      const filter = {};
      const deptId = await resolveDepartmentIdByName(args.departmentName);
      if (deptId) filter.departmentId = deptId;
      if (args.query) {
        const escaped = String(args.query).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
          { fullName: new RegExp(escaped, "i") },
          { employeeCode: new RegExp(escaped, "i") },
          { email: new RegExp(escaped, "i") },
        ];
      }
      const list = await Employee.find(filter)
        .limit(15)
        .populate("departmentId", "name code")
        .populate("designationId", "title")
        .lean();
      return list.map((e) => ({
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        email: e.email,
        department: e.departmentId?.name || "-",
        designation: e.designationId?.title || "-",
        status: e.employmentStatus,
        joiningDate: e.joiningDate,
        grossSalary: e.salaryStructure?.gross,
      }));
    }

    default:
      return { error: `Unknown tool ${toolName}` };
  }
}

async function buildPolicySystemPrompt(user, settings) {
  const { dateStr: todayStr } = getLocalDateTimeParts(new Date(), settings.timezone);
  const leaveTypes = await LeaveType.find({ isActive: true }).lean();
  const quotaText = leaveTypes.length
    ? leaveTypes
        .map((lt) => `${lt.name} (${lt.code}): ${lt.isUnlimited ? "Unlimited (Unpaid)" : `${lt.yearlyQuota} days/year`}`)
        .join(", ")
    : "Annual: 14 days, Sick: 8 days, Casual: 10 days, Unpaid: unlimited";

  const weekendNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekends = (settings.weekendDays || [0, 6]).map((d) => weekendNames[d]).join(", ");

  return `You are the official AI Assistant for "${settings.companyName}" inside HCM Lite.
Today's date is ${todayStr} (${settings.timezone}).
Logged-in User: Name="${user.name}", Role="${user.role.toUpperCase()}".

COMPANY POLICY & BUSINESS RULES (For company HR policy questions, answer strictly from these exact rules; if a specific company policy is not covered here or in tool results, clearly state you do not know):
1. Office Hours & Attendance:
   - Office hours: ${settings.officeStartTime} to ${settings.officeEndTime}.
   - Grace period: ${settings.graceMinutes} minutes (Check-in after ${settings.officeStartTime} + ${settings.graceMinutes} min is marked 'late').
   - Half-day rule: Working under ${settings.halfDayHours} hours is marked 'half_day'.
   - Missing check-out: Marked 'missing_checkout' if an employee checks in without checking out.
   - Absent: Marked 'absent' on working days with no attendance record and no approved leave.
   - Camera Check-in Geofence: Must detect exactly 1 face, GPS accuracy <= 100m, within ${settings.officeLocation?.radiusMeters || 150}m of office (${settings.officeLocation?.address || "Head Office"}).
2. Weekends & Leave Rules:
   - Weekends: ${weekends} (Leaves count working days only, skipping weekends and public holidays).
   - Leave Quotas: ${quotaText}.
   - Overlapping leave dates or exceeding remaining quota is rejected (HTTP 422).
3. Payroll & Tax Rules (${settings.currency || "PKR"}):
   - Default Salary Structure: Gross = 1.5 x Basic (HRA 40%, Medical 10%).
   - Per-day rate = Gross / working days in month. Joiners and leavers are prorated.
   - Deductions: Absent days + Unpaid leave days + (0.5 x Half-days)${settings.latePenaltyEnabled ? " + Late penalty (every 3 lates = 0.5 day deduction)" : ""}.
   - Annual Tax Slabs (on Gross x 12): Up to 600k = 0%; 600k-1.2M = 5% of excess; 1.2M-2.4M = 30k + 15% of excess; 2.4M-3.6M = 210k + 25% of excess; Above 3.6M = 510k + 35% of excess. Monthly tax = Annual tax / 12.
   - HR prepares monthly draft; only Admin can finalize and lock payroll.
4. Strict Role, Data & Conversational Guardrails:
   - An Employee can ONLY access their own attendance, leave balance, and own payslip. NEVER disclose any colleague's salary, attendance, or personal data to an Employee—politely refuse!
   - For ANY company/employee/attendance/leave/payroll numbers, ALWAYS invoke the relevant tool first and rely ONLY on tool results; never invent or guess HR numbers.
   - For casual greetings or general knowledge questions unrelated to confidential HR data, answer naturally, concisely, and helpfully like a modern AI assistant.
   - Language: Understand both English and Roman Urdu / Urdu. If the user writes in Roman Urdu (e.g. "meri kitni sick leaves baqi hain?"), reply naturally and helpfully in clear Roman Urdu or matching language!`;
}

function sanitizeChatHistory(history = []) {
  if (!Array.isArray(history)) return [];
  const cleaned = [];
  for (const item of history.slice(-10)) {
    if (!item || typeof item !== "object") continue;
    const role = item.role === "assistant" || item.sender === "ai" ? "assistant" : "user";
    const text = String(item.text || "").trim().slice(0, 1500);
    if (!text) continue;
    cleaned.push({ role, text });
  }
  return cleaned;
}

/**
 * Call Google Gemini API with Function Calling & Multi-Turn History (15s timeout)
 */
async function runGeminiChatWithTools({ apiKey, model, systemPrompt, message, history = [], user }) {
  const modelsToTry = [model, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"].filter(
    (v, i, a) => v && a.indexOf(v) === i
  );
  let lastErr = null;

  const priorTurns = sanitizeChatHistory(history);

  for (const m of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
      const toolsPayload = [
        {
          functionDeclarations: TOOL_DECLARATIONS.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];

      // Build valid alternating user/model contents array for Gemini
      const contents = [];
      for (const turn of priorTurns) {
        const gRole = turn.role === "assistant" ? "model" : "user";
        if (contents.length === 0 && gRole === "model") continue;
        const prev = contents[contents.length - 1];
        if (prev && prev.role === gRole) {
          prev.parts[0].text += `\n${turn.text}`;
        } else {
          contents.push({ role: gRole, parts: [{ text: turn.text }] });
        }
      }
      if (contents.length > 0 && contents[contents.length - 1].role === "user") {
        contents[contents.length - 1].parts[0].text += `\n${message}`;
      } else {
        contents.push({ role: "user", parts: [{ text: message }] });
      }

      const toolsCalled = [];

      for (let step = 0; step < 3; step++) {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            tools: toolsPayload,
            generationConfig: { temperature: 0.25 },
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Gemini HTTP ${resp.status}: ${errText.slice(0, 200)}`);
        }

        const data = await resp.json();
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const fnCalls = parts.filter((p) => p.functionCall);

        if (fnCalls.length === 0) {
          const answer = parts.map((p) => p.text || "").join("").trim();
          return { answer: answer || "I processed your request.", toolsCalled, provider: `gemini:${m}` };
        }

        contents.push({ role: "model", parts });
        const responseParts = [];
        for (const fc of fnCalls) {
          const { name, args } = fc.functionCall;
          toolsCalled.push(name);
          const result = await executeScopedTool(name, args || {}, user);
          responseParts.push({
            functionResponse: {
              name,
              response: { result },
            },
          });
        }
        contents.push({ role: "user", parts: responseParts });
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Gemini call failed");
}

/**
 * Call OpenAI-Compatible API (Groq or OpenAI) with Tool Calling & Multi-Turn History (15s timeout)
 */
async function runOpenAiCompatibleChatWithTools({
  provider,
  apiKey,
  model,
  systemPrompt,
  message,
  history = [],
  user,
}) {
  const baseUrl =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

  const tools = TOOL_DECLARATIONS.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const priorMessages = sanitizeChatHistory(history).map((h) => ({
    role: h.role === "assistant" ? "assistant" : "user",
    content: h.text,
  }));

  const messages = [
    { role: "system", content: systemPrompt },
    ...priorMessages,
    { role: "user", content: message },
  ];
  const toolsCalled = [];

  for (let step = 0; step < 3; step++) {
    const resp = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.25,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`${provider} HTTP ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const data = await resp.json();
    const choice = data.choices?.[0]?.message;
    if (!choice) throw new Error("Empty model response");

    if (!choice.tool_calls || choice.tool_calls.length === 0) {
      return {
        answer: (choice.content || "").trim(),
        toolsCalled,
        provider: `${provider}:${model}`,
      };
    }

    messages.push(choice);
    for (const tc of choice.tool_calls) {
      const fnName = tc.function.name;
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(tc.function.arguments || "{}");
      } catch {
        parsedArgs = {};
      }
      toolsCalled.push(fnName);
      const result = await executeScopedTool(fnName, parsedArgs, user);
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  return { answer: "Completed tool lookup.", toolsCalled, provider: `${provider}:${model}` };
}

/**
 * Intelligent Scoped Fallback Assistant (when AI_API_KEY is not configured or provider times out)
 * Uses the exact same scoped tools & policy rules so live numbers and RBAC always work!
 */
async function runDeterministicScopedAssistant(message, user, settings) {
  const q = String(message || "").toLowerCase().trim();
  const toolsCalled = [];

  // 1. Check colleague salary privacy violation for Employee
  if (
    user.role === "employee" &&
    (q.includes("salary") || q.includes("tankhwah") || q.includes("pay")) &&
    !q.includes("my ") &&
    !q.includes("meri") &&
    !q.includes("own") &&
    !q.includes("slab") &&
    !q.includes("tax") &&
    !q.includes("rule")
  ) {
    toolsCalled.push("get_payroll_summary");
    return {
      answer:
        "I'm sorry, salary and compensation records of other colleagues are strictly confidential. As an Employee, you can only view your own payslips and salary structure.",
      toolsCalled,
    };
  }

  // 2. Policy Q&A checks
  if (q.includes("grace") || q.includes("office hour") || q.includes("late rule") || q.includes("half day") || q.includes("timing")) {
    return {
      answer: `According to ${settings.companyName} policy: Office hours are ${settings.officeStartTime} to ${settings.officeEndTime} with a ${settings.graceMinutes}-minute grace period (check-in after that is marked Late). Working fewer than ${settings.halfDayHours} hours is marked Half-Day.${settings.latePenaltyEnabled ? " Every 3 lates result in a 0.5-day payroll deduction." : ""}`,
      toolsCalled,
    };
  }

  if (q.includes("tax") || q.includes("slab")) {
    return {
      answer:
        "Annual Tax Slabs (on Gross x 12): Up to 600,000 = 0%; 600,001 to 1,200,000 = 5% of excess; 1,200,001 to 2,400,000 = 30,000 + 15% of excess; 2,400,001 to 3,600,000 = 210,000 + 25% of excess; Above 3,600,000 = 510,000 + 35% of excess. Monthly tax is 1/12th of annual tax.",
      toolsCalled,
    };
  }

  // 3. Own leave balance (English & Roman Urdu)
  if (
    q.includes("leave balance") ||
    q.includes("leaves left") ||
    q.includes("sick leave") ||
    q.includes("casual leave") ||
    q.includes("annual leave") ||
    q.includes("chutti") ||
    q.includes("chuttiyan") ||
    q.includes("baqi")
  ) {
    if (user.role === "employee" || q.includes("my") || q.includes("meri") || q.includes("have left")) {
      toolsCalled.push("get_my_leave_balance");
      const res = await executeScopedTool("get_my_leave_balance", {}, user);
      const lines = (res.balances || []).map((b) =>
        b.isUnlimited
          ? `${b.name}: Unlimited (${b.approvedDays} used)`
          : `${b.name}: ${b.remaining} remaining out of ${b.quota} (${b.approvedDays} approved)`
      );
      return {
        answer: lines.length
          ? `Here is your current leave balance:\n• ${lines.join("\n• ")}`
          : "No leave types have been configured yet.",
        toolsCalled,
      };
    }
  }

  // 4. Who is on leave today / leave summary
  if (q.includes("on leave") || q.includes("who is off") || q.includes("leave summary") || q.includes("kon leave")) {
    toolsCalled.push("get_leave_summary");
    const res = await executeScopedTool("get_leave_summary", {}, user);
    if (res.scope === "own_employee_only") {
      return {
        answer: "Company-wide leave lists are restricted to HR and Admin. You can check your own leave balance anytime.",
        toolsCalled,
      };
    }
    const names = (res.onLeaveToday || []).map((p) => `${p.employeeName} (${p.leaveType})`).join(", ");
    return {
      answer:
        res.onLeaveTodayCount > 0
          ? `${res.onLeaveTodayCount} employee(s) on leave today (${res.todayStr}): ${names}. Pending leave approvals: ${res.pendingCount}.`
          : `0 employees are on approved leave today (${res.todayStr}). Pending leave approvals: ${res.pendingCount}.`,
      toolsCalled,
    };
  }

  // 5. Late comers
  if (q.includes("late") || q.includes("der se")) {
    toolsCalled.push("get_late_comers");
    const res = await executeScopedTool("get_late_comers", {}, user);
    if (res.accessDenied) return { answer: res.message, toolsCalled };
    if (!res.topLateComers?.length) {
      return { answer: `No late check-ins recorded between ${res.rangeStart} and ${res.rangeEnd}.`, toolsCalled };
    }
    const list = res.topLateComers
      .map((c, i) => `${i + 1}. ${c.fullName} (${c.departmentName}) — ${c.lateCount} late(s)`)
      .join("\n");
    return { answer: `Top late-comers (${res.rangeStart} to ${res.rangeEnd}):\n${list}`, toolsCalled };
  }

  // 6. Attendance rate / summary
  if (q.includes("attendance") || q.includes("present") || q.includes("hazri")) {
    toolsCalled.push("get_attendance_summary");
    const res = await executeScopedTool("get_attendance_summary", {}, user);
    const s = res.summary;
    return {
      answer: `Attendance Summary (${res.rangeStart} to ${res.rangeEnd}): Attendance Rate is ${s.attendanceRate}% | Present: ${s.present}, Late: ${s.late}, Half-day: ${s.halfDay}, On Leave: ${s.onLeave}, Absent: ${s.absent}.`,
      toolsCalled,
    };
  }

  // 7. Headcount / active employees in department
  if (q.includes("headcount") || q.includes("how many") || q.includes("active employee") || q.includes("kitne employee")) {
    let deptName = null;
    const inMatch = /in\s+([a-z0-9 &_-]+?)(\?|$|\.|department)/i.exec(message);
    if (inMatch) deptName = inMatch[1].trim();
    toolsCalled.push("get_headcount");
    const res = await executeScopedTool("get_headcount", { departmentName: deptName }, user);
    if (res.accessDenied) return { answer: res.message, toolsCalled };
    if (res.error) return { answer: res.error, toolsCalled };
    const deptBreakdown = (res.byDepartment || []).map((d) => `${d.departmentName}: ${d.count}`).join(", ");
    return {
      answer: `Active Headcount: ${res.headcount} employee(s) (Active: ${res.activeCount}, Probation: ${res.probationCount}). Attrition Rate: ${res.attritionRate}%. Average Gross Salary: ${settings.currency} ${res.avgSalary.toLocaleString()}.${deptBreakdown ? ` By Department — ${deptBreakdown}.` : ""}`,
      toolsCalled,
    };
  }

  // 8. Payroll / My salary
  if (q.includes("payroll") || q.includes("payslip") || q.includes("salary") || q.includes("tankhwah")) {
    toolsCalled.push("get_payroll_summary");
    const res = await executeScopedTool("get_payroll_summary", {}, user);
    if (res.accessDenied) return { answer: res.message, toolsCalled };
    if (user.role === "employee") {
      if (!res.hasPayslip) return { answer: res.message, toolsCalled };
      return {
        answer: `Your latest payslip (${res.month}/${res.year}, ${res.status}): Gross ${settings.currency} ${res.gross.toLocaleString()}, Tax ${settings.currency} ${res.monthlyTax.toLocaleString()}, Deductions ${settings.currency} ${res.attendanceDeduction.toLocaleString()}, Net Pay ${settings.currency} ${res.netPay.toLocaleString()}.`,
        toolsCalled,
      };
    }
    if (!res.hasPayrollRun) return { answer: "No payroll run has been generated yet.", toolsCalled };
    return {
      answer: `Payroll Run (${res.month}/${res.year} — ${res.status}): ${res.employeeCount} employees | Total Gross: ${settings.currency} ${res.totalGross.toLocaleString()} | Total Tax: ${settings.currency} ${res.totalTax.toLocaleString()} | Total Net: ${settings.currency} ${res.totalNet.toLocaleString()}.`,
      toolsCalled,
    };
  }

  // 9. Friendly greetings
  if (/^(hi|hello|hey|salam|assalam|aoa|kese ho|kaise ho|good morning|good evening)\b/i.test(q)) {
    return {
      answer: `Walaikum Assalam ${user.name}! Main ${settings.companyName} ka HCM Lite AI Assistant hoon (${user.role.toUpperCase()} access). Aap mujh se live attendance, leave balances, company rules, ya payroll ke baare mein English ya Roman Urdu mein pooch sakte hain!`,
      toolsCalled,
    };
  }

  return {
    answer: `Hello ${user.name}! Live HR tools (attendance, leave balances, policies, headcount, late-comers, payroll) abhi active hain. Open-ended general questions ke liye \`backend/.env\` mein \`AI_API_KEY=\` ke aagay apni Gemini/Groq key paste kar ke Ctrl+S dabayein — server bina restart kiye foran key pick kar lega!`,
    toolsCalled,
  };
}

/**
 * Main Entry: Chat with Tools, Multi-Turn History & Policy Q&A
 */
export async function handleAiChat({ message, history = [], user }) {
  const startMs = Date.now();
  const rate = await checkAiRateLimit(user._id);
  if (!rate.allowed) {
    await AiLog.create({
      userId: user._id,
      role: user.role,
      feature: "chat",
      prompt: String(message).slice(0, 500),
      toolsCalled: [],
      provider: "rate_limiter",
      durationMs: Date.now() - startMs,
      status: "rate_limited",
    });
    return {
      rateLimited: true,
      answer: "Rate limit reached (max ~20 AI requests per hour). Please wait a few minutes and try again.",
      aiGenerated: true,
      toolsCalled: [],
    };
  }

  const settings = await getActiveSettings();
  const systemPrompt = await buildPolicySystemPrompt(user, settings);
  const cfg = detectAiProvider();

  try {
    if (cfg.provider === "none") {
      const fb = await runDeterministicScopedAssistant(message, user, settings);
      await AiLog.create({
        userId: user._id,
        role: user.role,
        feature: "chat",
        prompt: String(message).slice(0, 500),
        toolsCalled: fb.toolsCalled,
        provider: "scoped-fallback",
        durationMs: Date.now() - startMs,
        status: "fallback",
      });
      return {
        answer: fb.answer,
        toolsCalled: fb.toolsCalled,
        provider: "scoped-fallback",
        aiGenerated: true,
      };
    }

    const res =
      cfg.provider === "gemini"
        ? await runGeminiChatWithTools({
            apiKey: cfg.key,
            model: cfg.model,
            systemPrompt,
            message,
            history,
            user,
          })
        : await runOpenAiCompatibleChatWithTools({
            provider: cfg.provider,
            apiKey: cfg.key,
            model: cfg.model,
            systemPrompt,
            message,
            history,
            user,
          });

    await AiLog.create({
      userId: user._id,
      role: user.role,
      feature: "chat",
      prompt: String(message).slice(0, 500),
      toolsCalled: res.toolsCalled,
      provider: res.provider,
      durationMs: Date.now() - startMs,
      status: "success",
    });

    return {
      answer: res.answer,
      toolsCalled: res.toolsCalled,
      provider: res.provider,
      aiGenerated: true,
    };
  } catch (err) {
    console.warn("LLM fallback triggered:", err.message);
    const fb = await runDeterministicScopedAssistant(message, user, settings);
    await AiLog.create({
      userId: user._id,
      role: user.role,
      feature: "chat",
      prompt: String(message).slice(0, 500),
      toolsCalled: fb.toolsCalled,
      provider: "scoped-fallback",
      durationMs: Date.now() - startMs,
      status: "fallback",
    });
    return {
      answer: fb.answer,
      toolsCalled: fb.toolsCalled,
      provider: "scoped-fallback",
      aiGenerated: true,
      fallbackUsed: true,
    };
  }
}

/**
 * Dashboard Summary (M8): Sends KPI JSON -> returns 3-5 insight bullets using ONLY those numbers
 */
export async function handleAiDashboardSummary({ kpiData, dashboardType, user }) {
  const startMs = Date.now();
  const cfg = detectAiProvider();
  const prompt = `Summarize this ${dashboardType.toUpperCase()} dashboard KPI JSON in 3 to 5 crisp, executive bullet points.
STRICT RULE: Use ONLY the exact numbers provided in the JSON below. Never invent numbers. Output plain bullet lines starting with "• ".
KPI JSON: ${JSON.stringify(kpiData)}`;

  const buildFallbackBullets = () => {
    const bullets = [];
    if (kpiData?.headcount !== undefined) {
      bullets.push(
        `• Active Workforce: ${kpiData.headcount} employee(s) currently active/probation with ${kpiData.attritionRate ?? 0}% YTD attrition.`
      );
    }
    if (kpiData?.today) {
      bullets.push(
        `• Today's Snapshot: ${kpiData.today.present} present, ${kpiData.today.late} late, ${kpiData.today.onLeave} on approved leave, and ${kpiData.today.absent} absent.`
      );
    }
    if (kpiData?.attendanceRate !== undefined) {
      bullets.push(
        `• Period Attendance Rate stands at ${kpiData.attendanceRate}% with a ${kpiData.latePercentage ?? 0}% late arrival ratio.`
      );
    }
    if (kpiData?.payrollCost !== undefined) {
      bullets.push(
        `• Payroll Overview: Gross payroll is ${kpiData.currency || "PKR"} ${Number(kpiData.payrollCost || 0).toLocaleString()} with average gross salary at ${kpiData.currency || "PKR"} ${Number(kpiData.avgSalary || 0).toLocaleString()}.`
      );
    }
    if (kpiData?.pendingApprovals !== undefined) {
      bullets.push(`• Action Required: ${kpiData.pendingApprovals} pending leave/attendance approval request(s) in queue.`);
    }
    return bullets.slice(0, 5);
  };

  try {
    if (cfg.provider === "none") {
      const bullets = buildFallbackBullets();
      await AiLog.create({
        userId: user._id,
        role: user.role,
        feature: "summarize",
        prompt: dashboardType,
        provider: "scoped-fallback",
        durationMs: Date.now() - startMs,
        status: "fallback",
      });
      return { bullets, aiGenerated: true, provider: "scoped-fallback" };
    }

    let rawText = "";
    if (cfg.provider === "gemini") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": cfg.key,
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      });
      if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}`);
      const data = await resp.json();
      rawText = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    } else {
      const baseUrl =
        cfg.provider === "groq"
          ? "https://api.groq.com/openai/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions";
      const resp = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
        }),
      });
      if (!resp.ok) throw new Error(`${cfg.provider} HTTP ${resp.status}`);
      const data = await resp.json();
      rawText = data.choices?.[0]?.message?.content || "";
    }

    const bullets = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 4)
      .slice(0, 5)
      .map((l) => (l.startsWith("•") || l.startsWith("-") || l.startsWith("*") ? `• ${l.replace(/^[•\-*]\s*/, "")}` : `• ${l}`));

    await AiLog.create({
      userId: user._id,
      role: user.role,
      feature: "summarize",
      prompt: dashboardType,
      provider: cfg.provider,
      durationMs: Date.now() - startMs,
      status: "success",
    });

    return { bullets: bullets.length ? bullets : buildFallbackBullets(), aiGenerated: true, provider: cfg.provider };
  } catch {
    const bullets = buildFallbackBullets();
    await AiLog.create({
      userId: user._id,
      role: user.role,
      feature: "summarize",
      prompt: dashboardType,
      provider: "scoped-fallback",
      durationMs: Date.now() - startMs,
      status: "fallback",
    });
    return { bullets, aiGenerated: true, provider: "scoped-fallback", fallbackUsed: true };
  }
}

/**
 * Deterministic Natural-Language Date & Leave Parser (Fallback + Validation Helper)
 * Handles English & Roman Urdu ("Need next Monday and Tuesday off for a wedding", "kal bukhar ki chutti")
 */
function parseSmartLeaveFallback(text, todayStr, availableCodes) {
  const lower = String(text || "").toLowerCase();
  let type = availableCodes.includes("casual") ? "casual" : availableCodes[0] || "casual";

  if (/(sick|fever|doctor|hospital|ill|medical|flu|bukhar|tabiyat|bimar)/.test(lower) && availableCodes.includes("sick")) {
    type = "sick";
  } else if (/(vacation|trip|annual|holiday|family tour)/.test(lower) && availableCodes.includes("annual")) {
    type = "annual";
  } else if (/(unpaid|without pay)/.test(lower) && availableCodes.includes("unpaid")) {
    type = "unpaid";
  }

  const baseDate = new Date(`${todayStr}T00:00:00Z`);
  const addDays = (d, n) => {
    const copy = new Date(d.getTime());
    copy.setUTCDate(copy.getUTCDate() + n);
    return copy.toISOString().slice(0, 10);
  };

  const dayMap = {
    sunday: 0, sun: 0, itwar: 0,
    monday: 1, mon: 1, peer: 1,
    tuesday: 2, tue: 2, tues: 2, mangal: 2,
    wednesday: 3, wed: 3, budh: 3,
    thursday: 4, thu: 4, thurs: 4, jumerat: 4,
    friday: 5, fri: 5, jumma: 5,
    saturday: 6, sat: 6, hafta: 6,
  };

  const isoMatches = text.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  let start = addDays(baseDate, 1);
  let end = start;

  if (isoMatches && isoMatches.length >= 1) {
    start = isoMatches[0];
    end = isoMatches[1] >= start ? isoMatches[1] : start;
  } else if (/\b(today|aaj)\b/.test(lower)) {
    start = todayStr;
    end = todayStr;
  } else if (/\b(tomorrow|kal)\b/.test(lower)) {
    start = addDays(baseDate, 1);
    const daysMatch = /(\d+)\s*(days?|din)/.exec(lower);
    end = daysMatch ? addDays(baseDate, Math.max(1, Number(daysMatch[1]))) : start;
  } else {
    const mentionedDays = [];
    const tokens = lower.split(/[^a-z]+/);
    const hasNextPrefix = /\b(next|agle|aglay)\b/.test(lower);
    for (const tok of tokens) {
      if (dayMap[tok] !== undefined) {
        mentionedDays.push(dayMap[tok]);
      }
    }
    if (mentionedDays.length > 0) {
      const curDow = baseDate.getUTCDay();
      let diff = (mentionedDays[0] - curDow + 7) % 7;
      if (diff === 0 || (hasNextPrefix && diff < 2)) diff += 7;
      const firstDate = new Date(baseDate.getTime());
      firstDate.setUTCDate(firstDate.getUTCDate() + diff);
      start = firstDate.toISOString().slice(0, 10);
      if (mentionedDays.length >= 2) {
        const span = (mentionedDays[mentionedDays.length - 1] - mentionedDays[0] + 7) % 7;
        end = addDays(firstDate, span);
      } else {
        end = start;
      }
    }
  }

  let reason = String(text || "").trim();
  const forMatch = /\b(?:for|because of|due to|ke liye)\s+(.+)$/i.exec(text);
  if (forMatch && forMatch[1].trim().length >= 3) {
    reason = forMatch[1].trim();
    reason = reason.charAt(0).toUpperCase() + reason.slice(1);
  }

  return { type, start, end, reason: reason || "Personal leave request" };
}

/**
 * Smart Leave (M8 #21): Converts natural language into validated { type, start, end, reason }
 * NEVER saves to database; retries once on invalid JSON, then falls back cleanly.
 */
export async function handleAiSmartLeave({ text, user }) {
  const startMs = Date.now();
  const settings = await getActiveSettings();
  const { dateStr: todayStr } = getLocalDateTimeParts(new Date(), settings.timezone);
  const [leaveTypes, holidays] = await Promise.all([
    LeaveType.find({ isActive: true }).lean(),
    Holiday.find().lean(),
  ]);

  const availableCodes = leaveTypes.length
    ? leaveTypes.map((l) => l.code)
    : ["annual", "sick", "casual", "unpaid"];

  const validateParsed = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    const type = String(obj.type || "").toLowerCase().trim();
    const start = String(obj.start || "").trim();
    const end = String(obj.end || obj.start || "").trim();
    const reason = String(obj.reason || "").trim();
    if (!availableCodes.includes(type)) return null;
    if (!isValidIsoDate(start) || !isValidIsoDate(end) || start > end) return null;
    if (!reason) return null;
    return { type, start, end, reason };
  };

  const cfg = detectAiProvider();
  const sysInstruction = `Today is ${todayStr} (${ new Date(`${todayStr}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }) }).
Extract a structured leave application from the user's sentence (English or Roman Urdu).
Allowed leave type codes: ${availableCodes.join(", ")} (use 'casual' for weddings/personal errands, 'sick' for illness/doctor, 'annual' for vacations).
Return ONLY valid JSON with exact keys: {"type": "...", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "reason": "..."} and no markdown fences.`;

  const callLlmOnce = async () => {
    let raw = "";
    if (cfg.provider === "gemini") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": cfg.key,
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sysInstruction }] },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      });
      if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}`);
      const data = await resp.json();
      raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    } else {
      const baseUrl =
        cfg.provider === "groq"
          ? "https://api.groq.com/openai/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions";
      const resp = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: "system", content: sysInstruction },
            { role: "user", content: text },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });
      if (!resp.ok) throw new Error(`${cfg.provider} HTTP ${resp.status}`);
      const data = await resp.json();
      raw = data.choices?.[0]?.message?.content || "";
    }
    const cleaned = raw.replace(/```json|```/gi, "").trim();
    return validateParsed(JSON.parse(cleaned));
  };

  let parsed = null;
  let status = "success";
  let usedProvider = cfg.provider;

  if (cfg.provider !== "none") {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        parsed = await callLlmOnce();
        if (parsed) break;
      } catch {
        // Retry once per guardrail requirement
      }
    }
  }

  if (!parsed) {
    parsed = parseSmartLeaveFallback(text, todayStr, availableCodes);
    status = "fallback";
    usedProvider = "smart-parser-fallback";
  }

  const holidaySet = new Set(holidays.map((h) => h.date));
  const workingDates = getWorkingDatesInRange(parsed.start, parsed.end, settings.weekendDays, holidaySet);
  const matchedLeaveType = leaveTypes.find((lt) => lt.code === parsed.type);

  await AiLog.create({
    userId: user._id,
    role: user.role,
    feature: "smart_leave",
    prompt: String(text).slice(0, 500),
    provider: usedProvider,
    durationMs: Date.now() - startMs,
    status,
  });

  return {
    suggestion: {
      ...parsed,
      leaveTypeId: matchedLeaveType ? String(matchedLeaveType._id) : null,
      leaveTypeName: matchedLeaveType ? matchedLeaveType.name : parsed.type,
      workingDays: workingDates.length,
    },
    aiGenerated: true,
    provider: usedProvider,
  };
}


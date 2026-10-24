import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ["normal", "important", "urgent"],
      default: "normal",
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null, // null = company-wide
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true },
  },
  { timestamps: true }
);

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["leave", "attendance", "payroll", "announcement", "account"],
      default: "announcement",
    },
    link: { type: String, default: "/dashboard" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorEmail: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, default: "" },
    summary: { type: String, default: "" },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const aiLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: { type: String, required: true },
    feature: {
      type: String,
      enum: ["chat", "summarize", "smart_leave"],
      required: true,
    },
    prompt: { type: String, required: true },
    toolsCalled: { type: [String], default: [] },
    provider: { type: String, default: "fallback" },
    durationMs: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["success", "fallback", "rate_limited", "error"],
      default: "success",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Announcement = mongoose.model("Announcement", announcementSchema);
export const Notification = mongoose.model("Notification", notificationSchema);
export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export const AiLog = mongoose.model("AiLog", aiLogSchema);


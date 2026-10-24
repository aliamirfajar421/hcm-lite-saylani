import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    checkInAt: {
      type: Date,
      default: null,
    },
    checkOutAt: {
      type: Date,
      default: null,
    },
    workedHours: {
      type: Number,
      default: 0,
    },
    isLate: {
      type: Boolean,
      default: false,
    },
    lateMinutes: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["present", "late", "half_day", "absent", "on_leave", "missing_checkout"],
      required: true,
    },
    source: {
      type: String,
      enum: ["web", "camera", "correction"],
      default: "web",
    },
    locationMeta: {
      distanceMeters: { type: Number, default: null },
      radiusMeters: { type: Number, default: null },
      accuracyMeters: { type: Number, default: null },
      faceDetected: { type: Boolean, default: false },
      livenessVerified: { type: Boolean, default: false },
      faceMatchScore: { type: Number, default: null },
    },
    appliedRules: {
      officeStartTime: { type: String, default: "09:00" },
      graceMinutes: { type: Number, default: 15 },
      halfDayHours: { type: Number, default: 5 },
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

const attendanceCorrectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      default: null,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    requestedCheckIn: {
      type: String, // HH:mm
      required: true,
    },
    requestedCheckOut: {
      type: String, // HH:mm
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewComment: {
      type: String,
      default: "",
      trim: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const Attendance = mongoose.model("Attendance", attendanceSchema);
export const AttendanceCorrection = mongoose.model("AttendanceCorrection", attendanceCorrectionSchema);


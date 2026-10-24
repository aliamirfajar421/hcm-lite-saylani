import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema(
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
    leaveTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveType",
      required: true,
    },
    leaveTypeCode: {
      type: String,
      required: true,
      lowercase: true,
    },
    leaveTypeName: {
      type: String,
      required: true,
    },
    startDate: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    endDate: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    workingDays: {
      type: Number,
      required: true,
      min: 0.5,
    },
    dates: {
      type: [String],
      default: [],
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ["manual", "smart_ai"],
      default: "manual",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
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

export default mongoose.model("LeaveRequest", leaveRequestSchema);


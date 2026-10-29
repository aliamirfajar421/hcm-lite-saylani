import mongoose from "mongoose";

const goalItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  targetMetric: { type: String, default: "" },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  status: {
    type: String,
    enum: ["in_progress", "completed", "delayed"],
    default: "in_progress",
  },
  createdAt: { type: Date, default: Date.now },
});

const performanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    period: {
      type: String,
      default: "Q4 2026",
      index: true,
    },
    goals: [goalItemSchema],
    managerRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    managerFeedback: {
      type: String,
      default: "",
    },
    aiSummary: {
      type: String,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Performance || mongoose.model("Performance", performanceSchema);


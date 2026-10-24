import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    employeeCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "male",
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    designationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Designation",
      default: null,
    },
    joiningDate: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    exitDate: {
      type: String, // YYYY-MM-DD or null
      default: null,
    },
    employmentStatus: {
      type: String,
      enum: ["active", "probation", "exited"],
      default: "active",
    },
    salaryStructure: {
      basic: { type: Number, required: true, min: 1 },
      hraPercent: { type: Number, default: 40, min: 0 },
      medicalPercent: { type: Number, default: 10, min: 0 },
      hra: { type: Number, default: 0 },
      medical: { type: Number, default: 0 },
      otherAllowances: { type: Number, default: 0, min: 0 },
      gross: { type: Number, required: true, min: 1 },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Employee", employeeSchema);


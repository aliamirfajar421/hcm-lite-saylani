import mongoose from "mongoose";

const companySettingsSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    tagline: { type: String, default: "People-first Human Capital Management", trim: true },
    currency: { type: String, default: "PKR", trim: true },
    timezone: { type: String, default: "Asia/Karachi", trim: true },
    officeStartTime: { type: String, default: "09:00" },
    officeEndTime: { type: String, default: "18:00" },
    graceMinutes: { type: Number, default: 15, min: 0, max: 180 },
    halfDayHours: { type: Number, default: 5, min: 1, max: 12 },
    weekendDays: {
      type: [Number],
      default: [0, 6], // 0 = Sunday, 6 = Saturday
    },
    officeLocation: {
      lat: { type: Number, default: 24.8607 },
      lng: { type: Number, default: 67.0011 },
      address: { type: String, default: "Head Office", trim: true },
      radiusMeters: { type: Number, default: 150, min: 10, max: 10000 },
    },
    storeAttendancePhoto: { type: Boolean, default: false },
    latePenaltyEnabled: { type: Boolean, default: true }, // Bonus rule: 3 lates = 0.5 day deduction
  },
  { timestamps: true }
);

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const designationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
    level: { type: String, default: "Mid", trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    yearlyQuota: { type: Number, default: 0, min: 0 },
    isPaid: { type: Boolean, default: true },
    isUnlimited: { type: Boolean, default: false },
    description: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    description: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

export const CompanySettings = mongoose.model("CompanySettings", companySettingsSchema);
export const Department = mongoose.model("Department", departmentSchema);
export const Designation = mongoose.model("Designation", designationSchema);
export const LeaveType = mongoose.model("LeaveType", leaveTypeSchema);
export const Holiday = mongoose.model("Holiday", holidaySchema);



const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  empId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SignUp",
    required: true
  },

  date: {
    type: Date,
    required: true
  },

  check_in: { type: String, default: null },
  check_in_period: { type: String, enum: ["AM", "PM"], default: null },

  check_out: { type: String, default: null },
  check_out_period: { type: String, enum: ["AM", "PM"], default: null },

  workingHours: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ["Present", "Absent", "Leave", "Half Day", "Holiday"],
    default: "Present"
  },

  breakStart: { type: String, default: null },
  breakEnd: { type: String, default: null },
  totalBreakDuration: { type: Number, default: 0 },
  currentBreakStartRaw: { type: Date, default: null },
  breakStatus: {
    type: String,
    enum: ["Working", "On Break"],
    default: "Working"
  },
  breaks: [
    {
      start: { type: String, required: true },
      end: { type: String, required: true },
      duration: { type: Number, required: true }
    }
  ],

  lastActive: { type: Date, default: null },

  remark: { type: String, default: null },

  officeStart: { type: String, default: "09:30" },
  officeEnd: { type: String, default: "18:30" },
  graceMinutes: { type: Number, default: 10 },
  dailyWorkingHours: { type: Number, default: 9 },

  isLateMinutes: { type: Number, default: 0 },
  isAutoMarkedAbsent: { type: Boolean, default: false },
  deductedHours: { type: Number, default: 0 },
  deductionAmount: { type: Number, default: 0 }
},
{ timestamps: true });

AttendanceSchema.index({ empId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);

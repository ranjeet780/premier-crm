
const mongoose = require('mongoose');

const SalarySchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'SignUp', required: true },

  month: { type: String, required: true },   // "01", "02", "11"
  year: { type: Number, required: true },

  // Salary Structure
  basicPay: { type: Number, required: true },
  perDaySalary: { type: Number, default: 0 },

  // Attendance based
  totalPresent: { type: Number, default: 0 },
  totalAbsent: { type: Number, default: 0 },
  totalHalfDays: { type: Number, default: 0 },

  // Leave based
  paidLeaves: { type: Number, default: 0 },
  unpaidLeaves: { type: Number, default: 0 },

  // Calculations
  overtimeHours: { type: Number, default: 0 },
  overtimePay: { type: Number, default: 0 },

  deductions: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },

  netPay: { type: Number, default: 0 },

  status: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
  totalWorkingHours: { type: Number, default: 0 },
  deductionDetails: {
  absent: { type: Number, default: 0 },
  halfDay: { type: Number, default: 0 },
  late: { type: Number, default: 0 },
  unpaidLeave: { type: Number, default: 0 }
},

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Salary', SalarySchema);

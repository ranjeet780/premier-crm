const mongoose = require('mongoose');

const SalaryAccessRequestSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "SignUp" },
  month: String,
  year: Number,
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" }
}, { timestamps: true });

module.exports = mongoose.model("SalaryAccessRequest", SalaryAccessRequestSchema);

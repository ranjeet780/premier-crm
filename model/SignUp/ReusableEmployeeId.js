const mongoose = require("mongoose");

const ReusableEmployeeIdSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true },
    year: { type: Number, required: true, index: true },
    seq: { type: Number, required: true, index: true },
    releasedFromUser: { type: mongoose.Schema.Types.ObjectId, ref: "SignUp" },
    reason: { type: String, enum: ["deleted", "blocked"], required: true },
  },
  { timestamps: true }
);

ReusableEmployeeIdSchema.index({ year: 1, seq: 1, createdAt: 1 });

module.exports = mongoose.model("ReusableEmployeeId", ReusableEmployeeIdSchema);

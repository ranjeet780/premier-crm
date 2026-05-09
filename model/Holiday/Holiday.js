const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true }, // store date only (00:00:00)
  title: { type: String, default: "Holiday" },
  description: { type: String, default: "" },
  isPaid: { type: Boolean, default: true }, // paid holiday true by default
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "SignUp" },
}, { timestamps: true });

module.exports = mongoose.model("Holiday", HolidaySchema);

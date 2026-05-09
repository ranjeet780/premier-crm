const mongoose = require("mongoose");

const NoticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String, default: "General" }, // e.g. Holiday, Task, General
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "SignUp" }, // admin
  // targets: either all, departments, or specific employees
  targets: {
    all: { type: Boolean, default: true },
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "department" }],
    employees: [{ type: mongoose.Schema.Types.ObjectId, ref: "SignUp" }]
  },
  notifyVia: {
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    push: { type: Boolean, default: false }
  },
  scheduledAt: { type: Date }, // optional scheduled send time
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notice", NoticeSchema);

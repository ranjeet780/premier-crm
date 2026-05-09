const mongoose = require("mongoose");

const adminNotificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "SignUp", required: true },
    title: String,
    message: String,
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("adminNotificationSchema", adminNotificationSchema);

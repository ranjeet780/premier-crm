// models/Notification.js
const mongoose = require("mongoose");

const JobOpeningnotificationSchema = new mongoose.Schema(
  {
    title: String,
    message: String,

    // 👇 VERY IMPORTANT
    targetRole: {
      type: String, // "admin"
      required: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("JobOpeningNotification", JobOpeningnotificationSchema);

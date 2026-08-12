const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      default: "Unknown User",
    },
    userEmail: {
      type: String,
      default: "unknown@system.local",
      trim: true,
    },
    userRole: {
      type: String,
      default: "user",
    },
    userId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    action: {
      type: String,
      default: "LOGIN",
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED"],
      default: "SUCCESS",
    },
    ipAddress: {
      type: String,
      default: "Unknown",
    },
    userAgent: {
      type: String,
      default: "Unknown",
    },
    deviceName: {
      type: String,
      default: "Unknown Device",
    },
    details: {
      type: String,
      default: "",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", AuditLogSchema);

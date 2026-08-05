const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      default: "Unknown User",
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
    },
    userRole: {
      type: String,
      default: "user",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    action: {
      type: String,
      enum: ["LOGIN", "LOGOUT", "FAILED_LOGIN", "OTHER"],
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

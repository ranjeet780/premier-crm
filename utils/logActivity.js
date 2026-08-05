const AuditLog = require("../model/AuditLog/AuditLog");

const createAuditLog = async ({
  userName,
  userEmail,
  userRole,
  userId,
  action,
  status = "SUCCESS",
  ipAddress = "Unknown",
  userAgent = "Unknown",
  details = "",
}) => {
  try {
    await AuditLog.create({
      userName: userName || "Unknown User",
      userEmail: userEmail || "N/A",
      userRole: userRole || "user",
      userId: userId || null,
      action: action || "LOGIN",
      status,
      ipAddress,
      userAgent,
      details,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("Error creating audit log entry:", err.message);
  }
};

const getClientIp = (req) => {
  if (!req) return "Unknown";
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || "Unknown";
};

module.exports = { createAuditLog, getClientIp };

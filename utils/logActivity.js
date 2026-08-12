const AuditLog = require("../model/AuditLog/AuditLog");

const parseDeviceName = (userAgent = "") => {
  if (!userAgent || typeof userAgent !== "string") return "Unknown Device";
  const ua = userAgent.toLowerCase();

  let os = "Unknown OS";
  if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone")) os = "iPhone";
  else if (ua.includes("ipad")) os = "iPad";
  else if (ua.includes("win")) os = "Windows";
  else if (ua.includes("mac")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";

  let browser = "";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome") || ua.includes("crios")) browser = "Chrome";
  else if (ua.includes("firefox") || ua.includes("fxios")) browser = "Firefox";
  else if (ua.includes("safari")) browser = "Safari";

  return `${os}${browser ? ` (${browser})` : ""}`;
};

const createAuditLog = async ({
  userName,
  userEmail,
  userRole,
  userId,
  action,
  status = "SUCCESS",
  ipAddress = "Unknown",
  userAgent = "Unknown",
  deviceName,
  details = "",
}) => {
  try {
    const computedDeviceName = deviceName || parseDeviceName(userAgent);

    await AuditLog.create({
      userName: userName || "Unknown User",
      userEmail: userEmail || "unknown@system.local",
      userRole: userRole || "user",
      userId: userId || null,
      action: action || "LOGIN",
      status,
      ipAddress,
      userAgent,
      deviceName: computedDeviceName,
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

module.exports = { createAuditLog, getClientIp, parseDeviceName };

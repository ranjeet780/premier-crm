const AuditLog = require("../../model/AuditLog/AuditLog");
const { createAuditLog, getClientIp } = require("../../utils/logActivity");

// Get logs with filtering & pagination
const getAuditLogs = async (req, res) => {
  try {
    const { search, role, action, status, startDate, endDate, page = 1, limit = 50 } = req.query;

    const query = {};

    if (search) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { userName: searchRegex },
        { userEmail: searchRegex },
        { details: searchRegex },
        { ipAddress: searchRegex },
      ];
    }

    if (role && role !== "all") {
      query.userRole = new RegExp(`^${role.trim()}$`, "i");
    }

    if (action && action !== "all") {
      query.action = action.toUpperCase();
    }

    if (status && status !== "all") {
      query.status = status.toUpperCase();
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.timestamp.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AuditLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      logs,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error("getAuditLogs error:", err);
    res.status(500).json({ message: "Failed to fetch activity logs", error: err.message });
  }
};

// Explicit Logout Endpoint
const recordLogout = async (req, res) => {
  try {
    const { userName, userEmail, userRole, userId } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "Unknown";

    await createAuditLog({
      userName: userName || req.user?.name || "User",
      userEmail: userEmail || req.user?.email || "Unknown",
      userRole: userRole || req.user?.role || "user",
      userId: userId || req.user?.id || req.user?._id,
      action: "LOGOUT",
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: "User initiated logout",
    });

    res.status(200).json({ success: true, message: "Logout activity logged successfully" });
  } catch (err) {
    console.error("recordLogout error:", err);
    res.status(500).json({ message: "Error recording logout", error: err.message });
  }
};

// Clear Logs
const clearAuditLogs = async (req, res) => {
  try {
    await AuditLog.deleteMany({});
    res.status(200).json({ success: true, message: "Activity logs cleared successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error clearing logs", error: err.message });
  }
};

module.exports = {
  getAuditLogs,
  recordLogout,
  clearAuditLogs,
};

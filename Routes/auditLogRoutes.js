const express = require("express");
const router = express.Router();
const { getAuditLogs, recordLogout, clearAuditLogs } = require("../controller/AuditLog/AuditLogController");
const authMiddleware = require("../controller/middleware/authMiddleware");

// GET /api/audit-logs - Restricted to superadmin/admin (or authenticated admin users)
router.get("/", authMiddleware, getAuditLogs);

// POST /api/audit-logs/logout - Log logout from frontend
router.post("/logout", recordLogout);

// DELETE /api/audit-logs/clear - Clear logs
router.delete("/clear", authMiddleware, clearAuditLogs);

module.exports = router;

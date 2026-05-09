const express = require("express");
const router = express.Router();

const {
  
  markNotificationRead,
  getEmployeeNotifications,
  getTaskNotificationForEmployee,
} = require("../controller/Notification/getEmployeeNotification");
const { getEmployeeNotificationsInEmp, getUnreadCount, getEmployeeNotificationsForEmp, hasNewNotification, markAllReadInEmp } = require("../controller/Notification/employeeNotification");

router.get(
  "/task/:taskId/employee/:employeeId",
  getTaskNotificationForEmployee
);
// ✅ SPECIFIC routes FIRST
router.get("/employee/unread/:employeeId", getUnreadCount);
router.put("/employee/readAll/:employeeId", markAllReadInEmp);
router.put("/read/:id", markNotificationRead);

// ✅ GENERIC route LAST
router.get("/employee/:employeeId", getEmployeeNotificationsForEmp);

module.exports = router;

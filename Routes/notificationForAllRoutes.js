const express = require("express");
const router = express.Router();
const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
} = require("../controller/Notification/notificationForAllController");
const authMiddleware = require("../controller/middleware/authMiddleware");

router.use(authMiddleware);

router.get("/my", getMyNotifications);
router.put("/read/:id", markAsRead);
router.put("/read-all", markAllAsRead);

module.exports = router;

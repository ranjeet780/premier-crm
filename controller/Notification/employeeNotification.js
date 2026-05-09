const Notification = require("../../model/Notification/Notification");
const SignUp = require("../../model/SignUp/SignUp");
const mongoose = require("mongoose");

const resolveEmployeeObjectId = async (employeeIdParam) => {
  if (!employeeIdParam) return null;
  if (mongoose.Types.ObjectId.isValid(employeeIdParam)) {
    return employeeIdParam;
  }
  const employee = await SignUp.findOne({ employeeId: employeeIdParam }).select("_id").lean();
  return employee?._id ? String(employee._id) : null;
};

/* ===============================
   GET EMPLOYEE NOTIFICATIONS
================================ */
const getEmployeeNotificationsForEmp = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const userId = await resolveEmployeeObjectId(employeeId);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid employeeId" });

    const notifications = await Notification.find({
      $or: [
        { allUsers: true },
        { "users.userId": userId }
      ]
    }).sort({ createdAt: -1 });

    const formatted = notifications.map(n => {
      const entry = n.users?.find(
        u => String(u.userId) === String(userId)
      );
      return {
        ...n.toObject(),
        isRead: !!entry?.readAt
      };
    });

    res.json({ success: true, notifications: formatted });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



/* ===============================
   UNREAD COUNT (SIDEBAR BADGE)
================================ */
const getUnreadCount = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const userId = await resolveEmployeeObjectId(employeeId);
    if (!userId) {
      return res.status(400).json({ success: false, message: "Invalid employeeId format" });
    }

    const notifications = await Notification.find({
      $or: [
        { allUsers: true },
        { "users.userId": userId }
      ]
    });

    let unread = 0;

    notifications.forEach(n => {
      const entry = n.users?.find(
        u => String(u.userId) === String(userId)
      );
      if (!entry || !entry.readAt) unread++;
    });

    res.json({ success: true, unread });

  } catch (err) {
    console.error("getUnreadCount error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


/* ===============================
   MARK ALL AS READ
================================ */
const markAllReadInEmp = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const userId = await resolveEmployeeObjectId(employeeId);
    if (!userId) {
      return res.status(400).json({ success: false, message: "Invalid employeeId format" });
    }

    const notifications = await Notification.find({
      $or: [
        { allUsers: true },
        { "users.userId": userId }
      ]
    });

    for (const n of notifications) {
      let entry = n.users.find(
        u => String(u.userId) === String(userId)
      );

      if (!entry) {
        n.users.push({ userId, readAt: new Date() });
      } else if (!entry.readAt) {
        entry.readAt = new Date();
      }

      await n.save();
    }

    res.json({ success: true });

  } catch (err) {
    console.error("markAllReadInEmp error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


module.exports = {
  getEmployeeNotificationsForEmp,
  getUnreadCount,
  markAllReadInEmp
};

// backend/controller/Notification/adminNotify.js
const Task = require("../../model/Task/Task");
const Notification = require("../../model/Notification/adminNotification");

// exports.notifyEmployees = async (req, res) => {
//   try {
//     const { taskId } = req.params;
//     const { message } = req.body;

//     const task = await Task.findById(taskId).populate("assignedTo");
//     if (!task) {
//       return res.status(404).json({ message: "Task not found" });
//     }

//     const notifications = task.assignedTo.map((emp) => ({
//       user: emp._id,
//       title: `Task Update: ${task.title}`,
//       message: message || "Admin sent an update on your task",
//       task: task._id,
//     }));

//     await Notification.insertMany(notifications);

//     res.json({ success: true, message: "Employees notified" });
//   } catch (err) {
//     console.error("ADMIN NOTIFY ERROR:", err);
//     res.status(500).json({ message: "Notify failed" });
//   }
// };

exports.notifyEmployees = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { message } = req.body;

    const task = await Task.findById(taskId).populate("assignedTo");
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const notifications = task.assignedTo.map((emp) => ({
      user: emp._id,
      title: `Task Update: ${task.title}`,
      message: message || "Admin sent an update on your task",
      task: task._id,
      isRead: false, // ✅ VERY IMPORTANT
    }));

    await Notification.insertMany(notifications);

    res.json({ success: true, message: "Employees notified" });
  } catch (err) {
    console.error("ADMIN NOTIFY ERROR:", err);
    res.status(500).json({ message: "Notify failed" });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const unreadNotifications = await Notification.find({
      user: employeeId,
      isRead: false,          // ✅ VERY IMPORTANT
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      unread: unreadNotifications.length,
      latest: unreadNotifications[0] || null, // ✅ only unread
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // ✅ mark as read
    notification.isRead = true;
    await notification.save();

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (err) {
    console.error("markNotificationRead error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
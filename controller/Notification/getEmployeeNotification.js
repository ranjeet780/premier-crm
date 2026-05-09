const Notification = require("../../model/Notification/adminNotification");
const EmployeeNotification = require("../../model/Notification/Notification");
const SignUp = require("../../model/SignUp/SignUp");

exports.getEmployeeNotifications = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const notifications = await Notification.find({
      user: employeeId,
      isRead: false,
    })
      .sort({ createdAt: -1 })
      .limit(1); // 👈 only latest banner

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const notificationId = req.params.notificationId || req.params.id;
    const employeeIdParam = req.body?.employeeId;

    await Notification.findByIdAndUpdate(notificationId, {
      isRead: true,
    });

    const empNotification = await EmployeeNotification.findById(notificationId);
    if (empNotification) {
      let readerId = employeeIdParam;

      // If employeeId is business id, resolve it to Mongo _id
      if (readerId && !String(readerId).match(/^[a-f\d]{24}$/i)) {
        const emp = await SignUp.findOne({ employeeId: readerId }).select("_id").lean();
        readerId = emp?._id ? String(emp._id) : null;
      }

      if (empNotification.allUsers) {
        const idx = empNotification.users.findIndex(
          (u) => String(u.userId) === String(readerId)
        );
        if (idx === -1 && readerId) {
          empNotification.users.push({ userId: readerId, readAt: new Date() });
        } else if (idx > -1 && !empNotification.users[idx].readAt) {
          empNotification.users[idx].readAt = new Date();
        }
      } else if (empNotification.users?.length) {
        if (readerId) {
          const idx = empNotification.users.findIndex(
            (u) => String(u.userId) === String(readerId)
          );
          if (idx > -1) {
            empNotification.users[idx].readAt = new Date();
          } else {
            empNotification.users[0].readAt = new Date();
          }
        } else {
          empNotification.users[0].readAt = new Date();
        }
      }

      await empNotification.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark read" });
  }
};
exports.getTaskNotificationForEmployee = async (req, res) => {
  try {
    const { taskId, employeeId } = req.params;

    const messages = await Notification.find({
      task: taskId,
      user: employeeId
    })
      .sort({ createdAt: -1 }); // newest first

    res.json(messages); // ✅ ARRAY
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};



exports.getAdminMessagesByTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const messages = await Notification.find({ task: taskId })
      .populate("user", "ename")
      .sort({ createdAt: -1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Failed to load admin messages" });
  }
};


const Notification = require("../../model/Notification/Notification");
const User = require("../../model/SignUp/SignUp");
const { getIO } = require("../../socket");


const sendNotification = async (req, res) => {
  const { title, body, category = "General", priority, allUsers, userIds = [] } = req.body;

  const users = allUsers
    ? []
    : userIds.map(id => ({ userId: id }));

  let normalizedPriority = priority;
  if (!normalizedPriority) {
    normalizedPriority = category === "Task" ? "High" : category === "Holiday" ? "Medium" : "Low";
  }

  if (!["Low", "Medium", "High"].includes(normalizedPriority)) {
    normalizedPriority = "Low";
  }

  const notification = await Notification.create({
    title,
    body,
    category,
    priority: normalizedPriority,
    allUsers,
    users
  });

  res.json({ success: true, notification });
};

const getAllNotifications = async (req, res) => {
  try {
    // Get all notifications
    const notifications = await Notification.find().sort({ createdAt: -1 }).lean();

    // Go through each notification and add recipient names
    for (let noti of notifications) {
      // If notification is for selected users
      if (!noti.allUsers && Array.isArray(noti.users) && noti.users.length > 0) {
        // Get only ObjectId list
        const userIds = noti.users.map(u => u.userId);
        // Fetch user documents
        const employees = await User.find({ _id: { $in: userIds } }, "ename name email");
        // Attach readable list to notification object
        noti.recipientNames = employees.map(e => e.ename || e.name || e.email);
      } else {
        noti.recipientNames = ["All Employees"];
      }
    }

    res.status(200).json({
      message: "✅ Fetched unique admin notifications successfully",
      notifications,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

const markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const { userId } = req.body;
        let update = {};
        if (userId) {
          update = { $addToSet: { readBy: userId } };
        } else {
          // Fallback for admin bell endpoint where userId is not sent.
          update = { $set: { status: "read" } };
        }

        const notification = await Notification.findByIdAndUpdate(notificationId, update, {
          new: true,
        });

        if (!notification) return res.status(404).json({ message: "Notification not found" });

        res.status(200).json({ message: "Notification marked as read", notification });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error });
    }
};
const deleteNotice = async (req, res) => {
    try {
        const { id } = req.params; // notice ID from URL
        const deleted = await Notification.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ message: "Notice not found" });
        }

        res.json({ message: "✅ Notice deleted successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error deleting notice" });
    }
};

const updateNoticeMeta = async (req, res) => {
  try {
    const { id } = req.params;
    const { isPinned, isArchived, priority } = req.body;

    const update = {};
    if (typeof isPinned === "boolean") update.isPinned = isPinned;
    if (typeof isArchived === "boolean") update.isArchived = isArchived;
    if (typeof priority === "string" && ["Low", "Medium", "High"].includes(priority)) {
      update.priority = priority;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "No valid metadata provided" });
    }

    const notice = await Notification.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!notice) {
      return res.status(404).json({ message: "Notice not found" });
    }

    return res.status(200).json({ message: "Notice metadata updated", notice });
  } catch (error) {
    console.error("Error updating notice metadata:", error);
    return res.status(500).json({ message: "Server Error", error });
  }
};

module.exports = {
    sendNotification,
    deleteNotice,
    updateNoticeMeta,
    getAllNotifications,
    markAsRead,
};

const Notification = require("../../model/Notification/Notification");

const getEmployeeNotifications = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const notifications = await Notification.find({
      $or: [
        { allUsers: true },
        { "users.userId": employeeId }
      ]
    })
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for faster execution if not modifying docs

    // Filter out notifications already read by this employee if allUsers is true
    const filteredNotifications = notifications.map(n => {
      if (n.allUsers) {
        const userEntry = n.users.find(u => String(u.userId) === String(employeeId));
        return { ...n, isRead: !!userEntry?.readAt };
      } else {
        return { ...n, isRead: !!n.users[0]?.readAt };
      }
    });

    res.status(200).json({ notifications: filteredNotifications });
  } catch (error) {
    console.error("Error fetching employee notifications:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const markEmployeeNotificationAsRead = async (req, res) => {
  try {
    const { employeeId, notificationId } = req.params;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    // If it's an allUsers notification, add the employee to the users array with readAt timestamp
    if (notification.allUsers) {
      const userEntryIndex = notification.users.findIndex(u => String(u.userId) === String(employeeId));

      if (userEntryIndex === -1) {
        notification.users.push({ userId: employeeId, readAt: new Date() });
      } else if (!notification.users[userEntryIndex].readAt) {
        notification.users[userEntryIndex].readAt = new Date();
      }
    } else {
      // If it's a targeted notification, just mark the existing entry as read
      if (notification.users.length > 0 && String(notification.users[0].userId) === String(employeeId)) {
        notification.users[0].readAt = new Date();
      }
    }

    await notification.save();

    res.status(200).json({ message: "Notification marked as read." });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const markAllEmployeeNotificationsAsRead = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Mark all 'allUsers: true' notifications as read for this employee
    await Notification.updateMany(
      { allUsers: true, "users.userId": { $ne: employeeId } },
      { $push: { users: { userId: employeeId, readAt: new Date() } } }
    );

    // Mark all targeted notifications for this employee as read
    await Notification.updateMany(
      { "users.userId": employeeId, "users.readAt": null },
      { "users.$.readAt": new Date() }
    );

    res.status(200).json({ message: "All notifications marked as read." });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  getEmployeeNotifications,
  markEmployeeNotificationAsRead,
  markAllEmployeeNotificationsAsRead,
};

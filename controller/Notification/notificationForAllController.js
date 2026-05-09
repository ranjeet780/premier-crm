const NotificationForAll = require("../../model/Notification/NotificationForAll");

exports.getMyNotifications = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user._id;

    const notifications = await NotificationForAll.find({
      visibleToRoles: role,
    }).sort({ createdAt: -1 });

    const formatted = notifications.map((n) => {
      const isRead = n.readBy.some(
        (r) => r.userId.toString() === userId.toString()
      );
      return {
        ...n.toObject(),
        isRead,
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error("getMyNotifications error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    await NotificationForAll.findByIdAndUpdate(id, {
      $addToSet: { readBy: { userId } },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("markAsRead error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user._id;

    await NotificationForAll.updateMany(
      { visibleToRoles: role, "readBy.userId": { $ne: userId } },
      { $addToSet: { readBy: { userId } } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("markAllAsRead error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

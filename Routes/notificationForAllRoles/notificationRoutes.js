const NotificationForAll = require('../../model/Notification/NotificationForAll')
router.get("/my", async (req, res) => {
  const role = req.user.role;

  const notifications = await NotificationForAll.find({
    visibleToRoles: role,
  }).sort({ createdAt: -1 });

  res.json(notifications);
});

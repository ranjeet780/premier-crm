const JobOpeningNotification = require("../../model/Notification/JobOpeningNotification");


const getJobOpeningNotifications = async (req, res) => {
  const role = req.user.role;

  const notifications = await JobOpeningNotification.find({
    targetRole: role,
  }).sort({ createdAt: -1 });

  res.json(notifications);
};

const markAsReadJobOpeningNotification = async (req, res) => {
  await JobOpeningNotification.findByIdAndUpdate(req.params.id, {
    isRead: true,
  });
  res.json({ success: true });
};
module.exports={ getJobOpeningNotifications , markAsReadJobOpeningNotification}
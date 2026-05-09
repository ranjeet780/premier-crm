// const Notification = require("../models/Notification");

// const createNotification = async ({
//   type,
//   title,
//   message,
//   module,
//   refId,
//   createdBy,
//   io,
// }) => {
//   const notification = await Notification.create({
//     type,
//     title,
//     message,
//     module,
//     refId,
//     createdBy,
//     forRole: ["admin"],
//   });

//   // 🔔 Send real-time notification to all admins
//   io.to("admins").emit("new-notification", notification);

//   return notification;
// };

// module.exports = createNotification;

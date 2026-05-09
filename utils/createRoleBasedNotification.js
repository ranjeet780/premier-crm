const NotificationForAll = require("../model/Notification/NotificationForAll");
const { ALL_ROLES } = require("./roles");
const { getIO } = require("../socket");

async function createRoleBasedNotification({
  type,
  title,
  message,
  module,
  refId,
  actorUserId,
  actorRole,
}) {
  try {
    /* 🔹 All roles EXCEPT the actor’s role */
    const visibleToRoles = ALL_ROLES.filter(
      (role) => role !== actorRole
    );

    /* 🔹 Save in DB */
    const notification = await NotificationForAll.create({
      type,
      title,
      message,
      module,
      refId,
      createdByUser: actorUserId,
      createdByRole: actorRole,
      visibleToRoles,
    });

    /* 🔹 Emit socket to all roles except actor */
    const io = getIO();

    visibleToRoles.forEach((role) => {
      io.to(`role:${role}`).emit("new-notification", notification);
    });

    console.log("🔥 ROLE BASED NOTIFICATION CALLED", {
  actorUserId,
  actorRole,
  visibleToRoles
});
    return notification;
  } catch (err) {
    console.error("Notification error:", err);
  }
}

module.exports = createRoleBasedNotification;

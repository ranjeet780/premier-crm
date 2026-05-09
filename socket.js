const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Chat = require("./model/Chat/Chat");
const ChatGroup = require("./model/Chat/ChatGroup");

let io;
const onlineUsers = new Map(); // userId -> Set(socketId)

function directRoomKey(a, b) {
  const s = String(a || "");
  const r = String(b || "");
  return s < r ? `${s}|${r}` : `${r}|${s}`;
}

function addOnlineSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socketId);
}

function removeOnlineSocket(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (!sockets.size) {
    onlineUsers.delete(userId);
  }
}

function emitToUser(userId, event, payload) {
  const socketIds = onlineUsers.get(String(userId));
  if (!socketIds) return;
  socketIds.forEach((socketId) => io.to(socketId).emit(event, payload));
}

async function joinUserGroups(socket, userId) {
  try {
    const groups = await ChatGroup.find({ members: userId, isDeleted: false }).select("_id").lean();
    groups.forEach((group) => {
      socket.join(`group:${String(group._id)}`);
    });
  } catch (error) {
    console.error("joinUserGroups error:", error.message);
  }
}

function initSocket(server) {
  const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  console.log("Socket.io initialized");

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("register", async (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = String(decoded.id || decoded._id || "");
        const role = decoded.role || "employee";

        if (!userId) return;

        socket.userId = userId;
        socket.userRole = role;

        addOnlineSocket(userId, socket.id);

        socket.join(`user:${userId}`);
        await joinUserGroups(socket, userId);

        io.emit("presence:update", { userId, isOnline: true });
      } catch (err) {
        console.error("Register failed:", err.message);
      }
    });

    socket.on("join-admin", () => {
      socket.join("admins");
    });

    socket.on("join-role", (role) => {
      socket.join(`role:${role}`);
    });

    socket.on("join-chat-group", async ({ groupId }) => {
      try {
        if (!socket.userId || !groupId) return;
        const group = await ChatGroup.findOne({ _id: groupId, isDeleted: false }).lean();
        if (!group || !group.members.includes(socket.userId)) return;
        socket.join(`group:${String(groupId)}`);
      } catch (error) {
        console.error("join-chat-group error:", error.message);
      }
    });

    socket.on("send_message", async (payload) => {
      try {
        const { receiverId, groupId, message, media } = payload || {};
        if (!socket.userId || !String(message || "").trim()) return;

        const senderId = socket.userId;
        const timestamp = new Date();

        if (groupId) {
          const group = await ChatGroup.findOne({ _id: groupId, isDeleted: false }).lean();
          if (!group || !group.members.includes(senderId)) return;

          const newMsg = await Chat.create({
            senderId,
            groupId,
            conversationType: "group",
            message: String(message).trim(),
            messageType: media?.mimeType
              ? media.mimeType.startsWith("image/")
                ? "photo"
                : media.mimeType.startsWith("audio/")
                ? "voice"
                : media.mimeType.startsWith("video/")
                ? "video"
                : "file"
              : "text",
            media: media || undefined,
            timestamp,
            read: false,
          });

          io.to(`group:${String(groupId)}`).emit("message:new", newMsg);
          return;
        }

        if (!receiverId) return;

        const newMsg = await Chat.create({
          senderId,
          receiverId: String(receiverId),
          conversationType: "direct",
          roomKey: directRoomKey(senderId, receiverId),
          message: String(message).trim(),
          messageType: media?.mimeType
            ? media.mimeType.startsWith("image/")
              ? "photo"
              : media.mimeType.startsWith("audio/")
              ? "voice"
              : media.mimeType.startsWith("video/")
              ? "video"
              : "file"
            : "text",
          media: media || undefined,
          timestamp,
          read: false,
        });

        emitToUser(receiverId, "message:new", newMsg);
        emitToUser(senderId, "message:new", newMsg);
      } catch (error) {
        console.error("send_message socket error:", error.message);
      }
    });

    socket.on("delete_message", async ({ messageId }) => {
      try {
        if (!socket.userId || socket.userRole !== "superadmin") {
          socket.emit("chat:error", { message: "Only superadmin can delete message/media" });
          return;
        }

        const updated = await Chat.findByIdAndUpdate(
          messageId,
          {
            deleted: true,
            deletedAt: new Date(),
            deletedBy: socket.userId,
          },
          { new: true }
        );

        if (!updated) return;

        if (updated.conversationType === "group" && updated.groupId) {
          io.to(`group:${String(updated.groupId)}`).emit("chat:message_deleted", {
            messageId: String(updated._id),
            groupId: String(updated.groupId),
          });
          return;
        }

        if (updated.receiverId) {
          emitToUser(updated.receiverId, "chat:message_deleted", { messageId: String(updated._id) });
        }
        emitToUser(updated.senderId, "chat:message_deleted", { messageId: String(updated._id) });
      } catch (error) {
        console.error("delete_message socket error:", error.message);
      }
    });

    socket.on("typing:start", ({ receiverId, groupId }) => {
      if (!socket.userId) return;
      if (groupId) {
        socket.to(`group:${String(groupId)}`).emit("typing:start", { from: socket.userId, groupId: String(groupId) });
        return;
      }
      if (receiverId) {
        emitToUser(receiverId, "typing:start", { from: socket.userId, receiverId: String(receiverId) });
      }
    });

    socket.on("typing:stop", ({ receiverId, groupId }) => {
      if (!socket.userId) return;
      if (groupId) {
        socket.to(`group:${String(groupId)}`).emit("typing:stop", { from: socket.userId, groupId: String(groupId) });
        return;
      }
      if (receiverId) {
        emitToUser(receiverId, "typing:stop", { from: socket.userId, receiverId: String(receiverId) });
      }
    });

    socket.on("disconnect", () => {
      if (socket.userId) {
        removeOnlineSocket(socket.userId, socket.id);
        if (!onlineUsers.has(socket.userId)) {
          io.emit("presence:update", {
            userId: socket.userId,
            isOnline: false,
          });
        }
      }
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}

module.exports = { initSocket, getIO };

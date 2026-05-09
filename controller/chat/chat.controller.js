const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Chat = require("../../model/Chat/Chat");
const ChatGroup = require("../../model/Chat/ChatGroup");
const SignUp = require("../../model/SignUp/SignUp");
const ClientLead = require("../../model/ClientLead/ClientLead");
const Users = require("../../model/Users/Users");
const { getIO } = require("../../socket");

const chatMediaDir = path.join(__dirname, "..", "uploads", "chat-media");
if (!fs.existsSync(chatMediaDir)) {
  fs.mkdirSync(chatMediaDir, { recursive: true });
}

const mediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, chatMediaDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const mediaUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || "").toLowerCase().startsWith("image/")) {
      return cb(null, true);
    }

    const allowedMime = new Set([
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
      "video/x-ms-wmv",
      "video/x-flv",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/mp4",
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);

    const allowedExt = new Set([
      ".mp4",
      ".webm",
      ".mov",
      ".avi",
      ".mkv",
      ".wmv",
      ".flv",
      ".mp3",
      ".wav",
      ".ogg",
      ".m4a",
      ".pdf",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".docx",
    ]);

    const ext = path.extname(file.originalname || "").toLowerCase();
    const mimeOk = allowedMime.has((file.mimetype || "").toLowerCase());
    const extOk = allowedExt.has(ext);

    if (mimeOk || extOk) return cb(null, true);
    return cb(
      new Error(
        `Unsupported file type. Got mime="${file.mimetype || "unknown"}", ext="${ext || "none"}"`
      )
    );
  },
});

const normalize = (doc, type) => {
  if (!doc) return null;

  if (type === "employee") {
    return {
      _id: String(doc._id),
      name: doc.ename || doc.name || "Employee",
      role: doc.role || "employee",
    };
  }

  if (type === "client") {
    return {
      _id: String(doc._id),
      name: doc.leadName || doc.name || "Client",
      role: "client",
    };
  }

  return {
    _id: String(doc._id),
    name: doc.name || "Admin",
    role: doc.role || "admin",
  };
};

const directRoomKey = (a, b) => {
  const s = String(a || "");
  const r = String(b || "");
  return s < r ? `${s}|${r}` : `${r}|${s}`;
};

const csvEscape = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const canDelete = (req) => req.user?.role === "superadmin";

const toMessageType = (mimetype = "") => {
  if (mimetype.startsWith("image/")) return "photo";
  if (mimetype.startsWith("audio/")) return "voice";
  if (mimetype.startsWith("video/")) return "video";
  return "file";
};

const enrichGroupMembers = async (groupDoc) => {
  if (!groupDoc) return null;

  const group = typeof groupDoc.toObject === "function" ? groupDoc.toObject() : { ...groupDoc };
  const memberIds = (group.members || []).map((id) => String(id));

  if (!memberIds.length) {
    return { ...group, memberDetails: [] };
  }

  const [admins, employees] = await Promise.all([
    Users.find({ _id: { $in: memberIds } }, "_id name role").lean(),
    SignUp.find({ _id: { $in: memberIds } }, "_id ename role").lean(),
  ]);

  const detailsById = new Map();

  admins.forEach((u) => {
    detailsById.set(String(u._id), {
      _id: String(u._id),
      name: u.name || "Admin",
      role: u.role || "admin",
    });
  });

  employees.forEach((u) => {
    detailsById.set(String(u._id), {
      _id: String(u._id),
      name: u.ename || "Employee",
      role: u.role || "employee",
    });
  });

  const ordered = memberIds
    .map((id) => detailsById.get(id))
    .filter(Boolean);

  return {
    ...group,
    memberDetails: ordered,
  };
};

exports.mediaUpload = mediaUpload;

exports.sendMessage = async (req, res) => {
  try {
    const senderId = String(req.user?._id || req.body.senderId || "");
    const { receiverId, groupId, message, timestamp, mentions = [] } = req.body;

    if (!senderId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const trimmedMessage = String(message || "").trim();
    const file = req.file;

    if (!trimmedMessage && !file) {
      return res.status(400).json({ success: false, message: "Message or media is required" });
    }

    let payload = {
      senderId,
      message: trimmedMessage || (file ? file.originalname : ""),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      read: false,
      mentions: [],
    };

    if (file) {
      payload.media = {
        url: `/uploads/chat-media/${file.filename}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      };
      payload.messageType = toMessageType(file.mimetype);
    }

    if (groupId) {
      const group = await ChatGroup.findOne({ _id: groupId, isDeleted: false }).lean();
      if (!group) {
        return res.status(404).json({ success: false, message: "Group not found" });
      }
      if (!group.members.includes(senderId)) {
        return res.status(403).json({ success: false, message: "Not a member of this group" });
      }

      payload = {
        ...payload,
        groupId,
        conversationType: "group",
      };

      if (Array.isArray(mentions) && mentions.length > 0) {
        const memberIds = new Set((group.members || []).map(String));
        const cleanedMentions = mentions
          .map((m) => ({
            userId: String(m?.userId || ""),
            name: String(m?.name || "").trim(),
          }))
          .filter((m) => m.userId && memberIds.has(m.userId));

        const uniqueMentions = [];
        const seen = new Set();
        cleanedMentions.forEach((m) => {
          if (seen.has(m.userId)) return;
          seen.add(m.userId);
          uniqueMentions.push(m);
        });
        payload.mentions = uniqueMentions;
      }
    } else {
      if (!receiverId) {
        return res.status(400).json({ success: false, message: "receiverId required for direct chat" });
      }

      payload = {
        ...payload,
        receiverId: String(receiverId),
        roomKey: directRoomKey(senderId, receiverId),
        conversationType: "direct",
      };
    }

    let saved = await Chat.create(payload);

    // Realtime emit + delivery stamp for direct chat
    try {
      const io = getIO();
      if (saved.conversationType === "direct" && saved.receiverId) {
        const receiverRoom = io.sockets.adapter.rooms.get(`user:${String(saved.receiverId)}`);
        const receiverOnline = Boolean(receiverRoom && receiverRoom.size > 0);

        if (receiverOnline && !saved.deliveredAt) {
          const now = new Date();
          saved = await Chat.findByIdAndUpdate(
            saved._id,
            { $set: { deliveredAt: now } },
            { new: true }
          );
        }

        io.to(`user:${String(saved.receiverId)}`).emit("message:new", saved);
        io.to(`user:${String(saved.senderId)}`).emit("message:new", saved);
      } else if (saved.conversationType === "group" && saved.groupId) {
        io.to(`group:${String(saved.groupId)}`).emit("message:new", saved);
      }
    } catch (socketErr) {
      console.warn("sendMessage realtime emit failed:", socketErr.message);
    }

    return res.json({ success: true, chat: saved });
  } catch (e) {
    console.error("sendMessage error:", e);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.query.userId || req.query.user1 || "");
    const peerId = req.query.peerId || req.query.user2;
    const { groupId, page = 1, limit = 50 } = req.query;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const query = { deleted: { $ne: true } };

    if (groupId) {
      const group = await ChatGroup.findOne({ _id: groupId, isDeleted: false }).lean();
      if (!group) {
        return res.status(404).json({ success: false, message: "Group not found" });
      }
      if (!group.members.includes(userId)) {
        return res.status(403).json({ success: false, message: "Not a member of this group" });
      }
      query.groupId = groupId;
      query.conversationType = "group";
    } else {
      if (!peerId) {
        return res.status(400).json({ success: false, message: "peerId or groupId required" });
      }
      query.roomKey = directRoomKey(userId, peerId);
      query.conversationType = "direct";
    }

    const list = await Chat.find(query)
      .sort({ timestamp: 1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    return res.json({ success: true, messages: list });
  } catch (e) {
    console.error("getMessages error:", e);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.body.userId || req.body.user1 || "");
    const peerId = req.body.peerId || req.body.user2;
    const { groupId } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (groupId) {
      const now = new Date();
      await Chat.updateMany(
        {
          groupId,
          senderId: { $ne: userId },
          deleted: { $ne: true },
          read: false,
        },
        { $set: { read: true, seenAt: now, deliveredAt: now } }
      );

      return res.json({ success: true });
    }

    if (!peerId) {
      return res.status(400).json({ success: false, message: "peerId or groupId required" });
    }

    const roomKey = directRoomKey(userId, peerId);
    const now = new Date();
    const ids = await Chat.find(
      { roomKey, receiverId: userId, read: false, deleted: { $ne: true } },
      { _id: 1 }
    ).lean();

    await Chat.updateMany(
      { roomKey, receiverId: userId, read: false, deleted: { $ne: true } },
      { $set: { read: true, seenAt: now, deliveredAt: now } }
    );

    if (ids.length > 0) {
      try {
        const io = getIO();
        io.to(`user:${String(peerId)}`).emit("chat:read", {
          byUserId: String(userId),
          peerId: String(peerId),
          roomKey,
          messageIds: ids.map((x) => String(x._id)),
          seenAt: now,
        });
      } catch (socketErr) {
        console.warn("chat:read emit failed:", socketErr.message);
      }
    }
    return res.json({ success: true });
  } catch (e) {
    console.error("markAsRead error:", e);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    if (!canDelete(req)) {
      return res.status(403).json({
        success: false,
        message: "Delete is allowed only for superadmin",
      });
    }

    const { messageId } = req.params;
    const updated = await Chat.findByIdAndUpdate(
      messageId,
      {
        deleted: true,
        deletedAt: new Date(),
        deletedBy: String(req.user._id),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    return res.json({ success: true, message: "Message deleted by superadmin", chat: updated });
  } catch (e) {
    console.error("deleteMessage error:", e);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.togglePinMessage = async (req, res) => {
  try {
    const actorId = String(req.user?._id || "");
    const actorRole = String(req.user?.role || "").trim().toLowerCase();
    const { messageId } = req.params;
    const pin = req.body?.pin !== false;

    if (!actorId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const pinAllowedRoles = new Set(["superadmin", "admin", "manager"]);
    if (!pinAllowedRoles.has(actorRole)) {
      return res.status(403).json({
        success: false,
        message: "Only superadmin, admin, or manager can pin/unpin messages",
      });
    }

    const message = await Chat.findOne({ _id: messageId, deleted: { $ne: true } });
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    if (message.conversationType !== "group" || !message.groupId) {
      return res.status(400).json({ success: false, message: "Only group messages can be pinned" });
    }

    const group = await ChatGroup.findOne({ _id: message.groupId, isDeleted: false }).lean();
    if (!group || !(group.members || []).map(String).includes(actorId)) {
      return res.status(403).json({ success: false, message: "Not allowed to pin in this group" });
    }

    message.isPinned = pin;
    message.pinnedAt = pin ? new Date() : null;
    message.pinnedBy = pin ? actorId : "";
    await message.save();

    try {
      const io = getIO();
      io.to(`group:${String(message.groupId)}`).emit(
        pin ? "chat:message_pinned" : "chat:message_unpinned",
        { chat: message }
      );
    } catch (socketErr) {
      console.warn("togglePinMessage socket emit failed:", socketErr.message);
    }

    return res.json({
      success: true,
      message: pin ? "Message pinned" : "Message unpinned",
      chat: message,
    });
  } catch (error) {
    console.error("togglePinMessage error:", error);
    return res.status(500).json({ success: false, message: "Failed to update pin status" });
  }
};

exports.getAllChats = async (_req, res) => {
  try {
    const chats = await Chat.find({ deleted: { $ne: true } }).sort({ timestamp: -1 }).limit(500);
    return res.json({ success: true, chats });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.getChatUsers = async (req, res) => {
  try {
    const userRole = String(req.user?.role || req.query.role || "")
      .trim()
      .toLowerCase();
    const userId = String(req.user?._id || req.query.userId || "");
    const userSource = String(req.user?.source || "")
      .trim()
      .toLowerCase();

    let users = [];

      // Employee login should see superadmin/admin/manager + same department members.
      if (userSource === "employee") {
        const me = await SignUp.findById(userId).select("_id department").lean();
        const deptFilter = me?.department ? { department: me.department } : null;

        const [admins, departmentEmployees] = await Promise.all([
          Users.find({ role: { $in: ["superadmin", "admin", "manager"] } }, "name role").lean(),
          deptFilter
            ? SignUp.find(deptFilter, "employeeId ename role department").lean()
            : Promise.resolve([]),
        ]);

        users = [
          ...admins.map((a) => normalize(a, "admin")),
          ...departmentEmployees.map((e) => normalize(e, "employee")),
        ];
    } else if (["superadmin", "admin", "hr", "manager", "accountant"].includes(userRole)) {
      const [employees, admins] = await Promise.all([
        SignUp.find({}, "employeeId ename role").lean(),
        Users.find({}, "name role").lean(),
      ]);

      users = [
        ...employees.map((e) => normalize(e, "employee")),
        ...admins.map((a) => normalize(a, "admin")),
      ];
      } else if (["employee", "intern", "trainee"].includes(userRole)) {
        const me = await SignUp.findById(userId).select("_id department").lean();
        const deptFilter = me?.department ? { department: me.department } : null;

        const [admins, departmentEmployees] = await Promise.all([
          Users.find({ role: { $in: ["superadmin", "admin", "manager"] } }, "name role").lean(),
          deptFilter
            ? SignUp.find(deptFilter, "employeeId ename role department").lean()
            : Promise.resolve([]),
        ]);

        users = [
          ...admins.map((a) => normalize(a, "admin")),
          ...departmentEmployees.map((e) => normalize(e, "employee")),
        ];
    } else if (["client", "lead"].includes(userRole)) {
      const admins = await Users.find(
        { role: { $in: ["superadmin", "admin", "accountant"] } },
        "name role"
      ).lean();
      users = admins.map((a) => normalize(a, "admin"));
    } else {
      const [admins, clients] = await Promise.all([
        Users.find({}, "name role").lean(),
        ClientLead.find({}, "leadName name").lean(),
      ]);
      users = [...admins.map((a) => normalize(a, "admin")), ...clients.map((c) => normalize(c, "client"))];
    }

    const deduped = [];
    const seen = new Set();
    for (const user of users) {
      const id = String(user._id);
      if (!id || seen.has(id) || id === userId) continue;
      seen.add(id);
      deduped.push(user);
    }

    return res.json({ success: true, users: deduped });
  } catch (error) {
    console.error("getChatUsers error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch chat users" });
  }
};

exports.createGroup = async (req, res) => {
  try {
    if (String(req.user?.source || "").toLowerCase() === "employee") {
      return res.status(403).json({
        success: false,
        message: "Employees cannot create groups",
      });
    }

    const creatorId = String(req.user?._id || "");
    const { name, description = "", memberIds = [] } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Group name is required" });
    }

    const allMembers = Array.from(new Set([creatorId, ...memberIds.map(String)])).filter(Boolean);

    if (allMembers.length < 2) {
      return res.status(400).json({ success: false, message: "At least 2 members required" });
    }

    const group = await ChatGroup.create({
      name: String(name).trim(),
      description,
      createdBy: creatorId,
      members: allMembers,
      admins: [creatorId],
    });

    const enrichedGroup = await enrichGroupMembers(group);
    return res.status(201).json({ success: true, group: enrichedGroup });
  } catch (error) {
    console.error("createGroup error:", error);
    return res.status(500).json({ success: false, message: "Failed to create group" });
  }
};

exports.getMyGroups = async (req, res) => {
  try {
    const userId = String(req.user?._id || "");

    const groups = await ChatGroup.find({ members: userId, isDeleted: false })
      .sort({ updatedAt: -1 })
      .lean();

    const enrichedGroups = await Promise.all(groups.map((group) => enrichGroupMembers(group)));

    return res.json({ success: true, groups: enrichedGroups });
  } catch (error) {
    console.error("getMyGroups error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch groups" });
  }
};

exports.addGroupMembers = async (req, res) => {
  try {
    const userId = String(req.user?._id || "");
    const { groupId } = req.params;
    const { memberIds = [] } = req.body;

    const group = await ChatGroup.findOne({ _id: groupId, isDeleted: false });
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const isAdmin = group.admins.includes(userId) || req.user?.role === "superadmin";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Only group admin can add members" });
    }

    const incoming = memberIds.map(String).filter(Boolean);
    const existingSet = new Set(group.members.map(String));
    const newlyAdded = incoming.filter((id) => !existingSet.has(id));
    const merged = Array.from(new Set([...group.members, ...incoming])).filter(Boolean);
    group.members = merged;
    await group.save();
    const enrichedGroup = await enrichGroupMembers(group);

    if (newlyAdded.length > 0) {
      const actorName = req.user?.name || "User";

      await Chat.create({
        senderId: userId,
        groupId: group._id,
        conversationType: "group",
        message: `${actorName} added ${newlyAdded.length} member(s) to the group.`,
        messageType: "text",
        timestamp: new Date(),
        read: false,
      });
    }

    // Realtime notification so newly added users see group instantly in panel
    try {
      const io = getIO();
      newlyAdded.forEach((memberId) => {
        io.to(`user:${String(memberId)}`).emit("chat:group_added", {
          group: enrichedGroup,
          addedBy: {
            _id: userId,
            name: req.user?.name || "Admin",
            role: req.user?.role || "admin",
          },
        });
      });
    } catch (socketErr) {
      console.warn("chat:group_added emit failed:", socketErr.message);
    }

    return res.json({ success: true, group: enrichedGroup });
  } catch (error) {
    console.error("addGroupMembers error:", error);
    return res.status(500).json({ success: false, message: "Failed to add members" });
  }
};

exports.removeGroupMember = async (req, res) => {
  try {
    const actorId = String(req.user?._id || "");
    const { groupId, memberId } = req.params;

    const group = await ChatGroup.findOne({ _id: groupId, isDeleted: false });
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const isAdmin = group.admins.includes(actorId) || req.user?.role === "superadmin";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Only group admin can remove members" });
    }

    group.members = group.members.filter((member) => String(member) !== String(memberId));
    group.admins = group.admins.filter((member) => String(member) !== String(memberId));

    if (!group.members.length) {
      group.members = [actorId];
    }

    if (!group.admins.length) {
      group.admins = [actorId];
    }

    await group.save();
    const enrichedGroup = await enrichGroupMembers(group);

    return res.json({ success: true, group: enrichedGroup });
  } catch (error) {
    console.error("removeGroupMember error:", error);
    return res.status(500).json({ success: false, message: "Failed to remove member" });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    if (!canDelete(req)) {
      return res.status(403).json({ success: false, message: "Only superadmin can delete groups" });
    }

    const { groupId } = req.params;
    const group = await ChatGroup.findByIdAndUpdate(
      groupId,
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: String(req.user._id),
      },
      { new: true }
    );

    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    try {
      const io = getIO();
      io.to(`group:${String(group._id)}`).emit("chat:group_deleted", {
        groupId: String(group._id),
      });
    } catch (socketErr) {
      console.warn("chat:group_deleted emit failed:", socketErr.message);
    }

    return res.json({ success: true, group });
  } catch (error) {
    console.error("deleteGroup error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete group" });
  }
};

exports.leaveGroup = async (req, res) => {
  try {
    const actorId = String(req.user?._id || "");
    const { groupId } = req.params;

    const group = await ChatGroup.findById(groupId);
    if (!group) {
      return res.json({ success: true, message: "Group already unavailable" });
    }

    if (group.isDeleted) {
      return res.json({ success: true, message: "Group already deleted" });
    }

    const memberIds = group.members.map(String);
    if (!memberIds.includes(actorId)) {
      return res.status(403).json({ success: false, message: "You are not part of this group" });
    }

    group.members = memberIds.filter((id) => id !== actorId);
    group.admins = (group.admins || []).map(String).filter((id) => id !== actorId);

    if (!group.members.length) {
      group.isDeleted = true;
      group.deletedAt = new Date();
      group.deletedBy = actorId;
    } else if (!group.admins.length) {
      group.admins = [String(group.members[0])];
    }

    await group.save();

    const enrichedGroup = await enrichGroupMembers(group);
    return res.json({ success: true, group: enrichedGroup });
  } catch (error) {
    console.error("leaveGroup error:", error);
    return res.status(500).json({ success: false, message: "Failed to leave group" });
  }
};

exports.forwardMessage = async (req, res) => {
  try {
    const senderId = String(req.user?._id || "");
    const { messageId, receiverId, groupId } = req.body;

    if (!senderId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!messageId) {
      return res.status(400).json({ success: false, message: "messageId is required" });
    }

    if (!receiverId && !groupId) {
      return res.status(400).json({ success: false, message: "receiverId or groupId is required" });
    }

    const source = await Chat.findOne({ _id: messageId, deleted: { $ne: true } }).lean();
    if (!source) {
      return res.status(404).json({ success: false, message: "Source message not found" });
    }

    const isSourceAllowedDirect =
      source.conversationType === "direct" &&
      String(source.roomKey || "")
        .split("|")
        .map((id) => String(id))
        .includes(senderId);

    const isSourceAllowedGroup =
      source.conversationType === "group" &&
      source.groupId &&
      (await ChatGroup.exists({ _id: source.groupId, members: senderId, isDeleted: false }));

    const isSourceAllowed = isSourceAllowedDirect || isSourceAllowedGroup;

    if (!isSourceAllowed) {
      return res.status(403).json({ success: false, message: "You cannot forward this message" });
    }

    let payload = {
      senderId,
      message: source.message || "Forwarded message",
      messageType: source.messageType || "text",
      media: source.media || undefined,
      mentions: Array.isArray(source.mentions) ? source.mentions : [],
      timestamp: new Date(),
      read: false,
      isForwarded: true,
      forwardedFromMessageId: String(source._id),
      forwardedFromSenderId: String(source.senderId || ""),
    };

    if (groupId) {
      const group = await ChatGroup.findOne({ _id: groupId, members: senderId, isDeleted: false }).lean();
      if (!group) {
        return res.status(403).json({ success: false, message: "You are not a member of this group" });
      }
      payload = {
        ...payload,
        groupId,
        conversationType: "group",
      };
    } else {
      payload = {
        ...payload,
        receiverId: String(receiverId),
        roomKey: directRoomKey(senderId, receiverId),
        conversationType: "direct",
      };
    }

    let saved = await Chat.create(payload);

    try {
      const io = getIO();
      if (saved.conversationType === "direct" && saved.receiverId) {
        const receiverRoom = io.sockets.adapter.rooms.get(`user:${String(saved.receiverId)}`);
        const receiverOnline = Boolean(receiverRoom && receiverRoom.size > 0);

        if (receiverOnline && !saved.deliveredAt) {
          const now = new Date();
          saved = await Chat.findByIdAndUpdate(
            saved._id,
            { $set: { deliveredAt: now } },
            { new: true }
          );
        }

        io.to(`user:${String(saved.receiverId)}`).emit("message:new", saved);
        io.to(`user:${String(saved.senderId)}`).emit("message:new", saved);
      } else if (saved.conversationType === "group" && saved.groupId) {
        io.to(`group:${String(saved.groupId)}`).emit("message:new", saved);
      }
    } catch (socketErr) {
      console.warn("forwardMessage realtime emit failed:", socketErr.message);
    }

    return res.json({ success: true, chat: saved });
  } catch (error) {
    console.error("forwardMessage error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to forward message",
    });
  }
};

exports.downloadBackup = async (req, res) => {
  try {
    const userId = String(req.user?._id || "");
    const { peerId, groupId, format = "json" } = req.query;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!peerId && !groupId) {
      return res.status(400).json({ success: false, message: "peerId or groupId is required" });
    }

    const query = { deleted: { $ne: true } };

    if (groupId) {
      const group = await ChatGroup.findOne({ _id: groupId, members: userId, isDeleted: false }).lean();
      if (!group) {
        return res.status(403).json({ success: false, message: "Not a member of this group" });
      }
      query.groupId = groupId;
      query.conversationType = "group";
    } else {
      query.roomKey = directRoomKey(userId, peerId);
      query.conversationType = "direct";
    }

    const messages = await Chat.find(query).sort({ timestamp: 1 }).lean();
    const safeFormat = String(format || "json").toLowerCase();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const conversationName = groupId ? `group-${groupId}` : `direct-${userId}-${peerId}`;

    if (safeFormat === "csv") {
      const headers = [
        "messageId",
        "timestamp",
        "senderId",
        "receiverId",
        "groupId",
        "conversationType",
        "messageType",
        "message",
        "mediaUrl",
        "isForwarded",
        "forwardedFromMessageId",
      ];
      const rows = messages.map((m) =>
        [
          m._id,
          m.timestamp,
          m.senderId,
          m.receiverId || "",
          m.groupId || "",
          m.conversationType,
          m.messageType || "text",
          m.message || "",
          m.media?.url || "",
          m.isForwarded ? "true" : "false",
          m.forwardedFromMessageId || "",
        ]
          .map(csvEscape)
          .join(",")
      );

      const csv = [headers.join(","), ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="chat-backup-${conversationName}-${stamp}.csv"`);
      return res.send(csv);
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
      conversation: groupId ? { type: "group", id: String(groupId) } : { type: "direct", peerId: String(peerId) },
      count: messages.length,
      messages,
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="chat-backup-${conversationName}-${stamp}.json"`);
    return res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error("downloadBackup error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate backup" });
  }
};

const express = require("express");
const {
  sendMessage,
  getMessages,
  markAsRead,
  getAllChats,
  getChatUsers,
  mediaUpload,
  createGroup,
  getMyGroups,
  addGroupMembers,
  removeGroupMember,
  deleteGroup,
  deleteMessage,
  leaveGroup,
  forwardMessage,
  downloadBackup,
  togglePinMessage,
} = require("../controller/chat/chat.controller");
const chatAuth = require("../controller/middleware/chatAuth");


const router = express.Router();

const handleChatMediaUpload = (req, res, next) => {
  mediaUpload.single("media")(req, res, (err) => {
    if (!err) return next();
    return res.status(400).json({
      success: false,
      message: err.message || "Media upload failed",
    });
  });
};

router.get("/users", chatAuth, getChatUsers);
router.get("/messages", chatAuth, getMessages);
router.post("/send", chatAuth, handleChatMediaUpload, sendMessage);
router.post("/forward", chatAuth, forwardMessage);
router.post("/mark-read", chatAuth, markAsRead);
router.get("/backup", chatAuth, downloadBackup);
router.get("/all", chatAuth, getAllChats);
router.delete("/messages/:messageId", chatAuth, deleteMessage);
router.patch("/messages/:messageId/pin", chatAuth, togglePinMessage);
router.post("/messages/:messageId/pin", chatAuth, togglePinMessage);

router.get("/groups", chatAuth, getMyGroups);
router.post("/groups", chatAuth, createGroup);
router.patch("/groups/:groupId/members", chatAuth, addGroupMembers);
router.delete("/groups/:groupId/members/:memberId", chatAuth, removeGroupMember);
router.post("/groups/:groupId/leave", chatAuth, leaveGroup);
router.delete("/groups/:groupId", chatAuth, deleteGroup);

module.exports = router;

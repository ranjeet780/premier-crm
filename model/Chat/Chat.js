const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema(
  {
    senderId: { type: String, required: true },
    receiverId: { type: String },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatGroup", default: null },
    conversationType: { type: String, enum: ["direct", "group"], default: "direct", index: true },
    roomKey: { type: String, index: true },
    message: { type: String, required: true },
    messageType: { type: String, enum: ["text", "photo", "voice", "video", "file", "poll"], default: "text" },
    media: {
      url: { type: String, default: "" },
      originalName: { type: String, default: "" },
      mimeType: { type: String, default: "" },
      size: { type: Number, default: 0 },
    },
    poll: {
      question: { type: String, default: "" },
      options: [
        {
          optionId: { type: String, default: "" },
          text: { type: String, default: "" },
          votes: [{ type: String, default: "" }],
        },
      ],
      allowMultiple: { type: Boolean, default: false },
      expiresAt: { type: Date, default: null },
    },
    mentions: [
      {
        userId: { type: String, default: "" },
        name: { type: String, default: "" },
      },
    ],
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    pinnedBy: { type: String, default: "" },
    deliveredAt: { type: Date, default: null },
    read: { type: Boolean, default: false },
    seenAt: { type: Date, default: null },
    isForwarded: { type: Boolean, default: false },
    forwardedFromMessageId: { type: String, default: "" },
    forwardedFromSenderId: { type: String, default: "" },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ChatSchema.pre("save", function (next) {
  if (this.conversationType === "group" && this.groupId) {
    this.roomKey = `group:${String(this.groupId)}`;
    this.receiverId = "";
    return next();
  }

  const s = String(this.senderId || "");
  const r = String(this.receiverId || "");
  this.roomKey = s < r ? `${s}|${r}` : `${r}|${s}`;
  this.conversationType = "direct";
  this.groupId = null;
  next();
});

module.exports = mongoose.model("Chat", ChatSchema);

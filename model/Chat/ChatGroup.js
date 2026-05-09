const mongoose = require("mongoose");

const ChatGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    createdBy: { type: String, required: true, index: true },
    members: [{ type: String, required: true, index: true }],
    admins: [{ type: String, default: [] }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

ChatGroupSchema.index({ members: 1, isDeleted: 1 });

module.exports = mongoose.model("ChatGroup", ChatGroupSchema);

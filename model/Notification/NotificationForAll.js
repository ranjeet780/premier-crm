const mongoose = require("mongoose");

const notificationSchemaForAll = new mongoose.Schema(
  {
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    module: { type: String, required: true },
    refId: { type: mongoose.Schema.Types.ObjectId },

    createdByUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    createdByRole: {
      type: String,
      required: true,
    },

    visibleToRoles: {
      type: [String],
      required: true,
    },

    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId },
        readAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("NotificationForAll", notificationSchemaForAll);

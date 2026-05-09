
const mongoose = require("mongoose");
const Counter = require('../Counter/Counter');

const NotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    category: { type: String, default: "General" },
    priority: { type: String, enum: ["Low", "Medium", "High"], default: "Low" },
    isPinned: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    allUsers: { type: Boolean, default: false },
    users: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "SignUp" },
        readAt: { type: Date, default: null },
      },
    ],
    userCount: { type: Number, default: 0 },
    status: { type: String, default: "sent" },
    emailSent: { type: Boolean, default: false },
    pushSent: { type: Boolean, default: false },
    NotificationId: { type: String, unique: true },
  },
  { timestamps: true }
);

// Unique notification for same content for all users
NotificationSchema.index(
  { title: 1, body: 1, category: 1, allUsers: 1 },
  { unique: true, partialFilterExpression: { allUsers: true } }
);

// Unique per user notification (for targeted users)
NotificationSchema.index(
  { title: 1, body: 1, category: 1, "users.userId": 1 },
  { unique: true, partialFilterExpression: { allUsers: false } }
);

// Sequential NotificationId using Counter
NotificationSchema.pre("save", async function (next) {
  if (!this.isNew || this.NotificationId) return next();
  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: "NotificationId" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const year = new Date().getFullYear();
    const seqNum = String(counter.seq).padStart(5, "0");
    this.NotificationId = `ID${year}-${seqNum}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Notification", NotificationSchema);

const mongoose = require("mongoose");
const Counter = require("../Counter/Counter");

const taskSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientLeads", required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "projects", required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "service" },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "department" },

    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "SignUp" }],

    title: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    priority: { type: String, default: "Low" },

    startDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },

    isRunning: {
      type: Boolean,
      default: false
    },
    estimatedTime: { type: Number, default: 0 }, // seconds
    timeSpent: { type: Number, default: 0 }, // seconds

    timeLogs: [
      {
        startAt: Date,
        endAt: Date,
        duration: Number, // seconds
      }
    ],

    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed"],
      default: "Pending",
    },

    statusHistory: [
      {
        status: {
          type: String,
          enum: ["Pending", "In Progress", "Completed"],
          required: true
        },
        reason: String,
        progress: Number,
        attachment: String,
        updatedAt: { type: Date, default: Date.now }
      }
    ],

    completedOn: { type: Date, default: null },

    incompleteReason: { type: String, default: "" },

    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "SignUp" },
        text: String,
        attachment: { type: String, default: "" }, // stored filepath
        visibleToClient: { type: Boolean, default: false }, // client can view if true
        createdAt: { type: Date, default: Date.now }
      }
    ],

    TaskId: { type: String }
  },
  { timestamps: true }
);

// AUTO GENERATE TaskId
taskSchema.pre("save", async function (next) {
  if (!this.isNew || this.TaskId) return next();
  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: "TaskId" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const year = new Date().getFullYear();
    this.TaskId = `TASK-${year}-${String(counter.seq).padStart(4, "0")}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Task", taskSchema);

const cron = require("node-cron");
const Task = require("../model/Task/Task");
const Notification = require("../model/Notification/Notification");
const NotificationForAll = require("../model/Notification/NotificationForAll");
const User = require("../model/Users/Users");
const { getIO } = require("../socket");

const runTaskDeadlineReminderJob = async () => {
  try {
    console.log("⏳ Running Task Deadline Reminder Cron...");

    // We only care about active, non-completed tasks (Pending, In Progress)
    const activeTasks = await Task.find({
      status: { $in: ["Pending", "In Progress"] },
      dueDate: { $gt: new Date() }  // only tasks whose due date is in the future
    });

    if (!activeTasks.length) {
      console.log("✅ No active tasks found for deadline reminder");
      return;
    }

    const systemUser = (await User.findOne({ role: "superadmin" }).select("_id")) || (await User.findOne().select("_id"));
    let io;
    try {
      io = getIO();
    } catch (err) {
      console.log("⚠️ Socket.IO not yet initialized, skipping real-time emits for now.");
    }
    
    const now = new Date();

    for (const task of activeTasks) {
      const diffMs = new Date(task.dueDate) - now;
      const diffHours = diffMs / (1000 * 60 * 60);

      // Sent offsets array inside task
      const sentOffsets = Array.isArray(task.reminder_offsets_sent) ? task.reminder_offsets_sent : [];
      let shouldSave = false;

      // Define our reminder checkpoints:
      // - 3 days (72 hrs) -> offset 3
      // - 2 days (48 hrs) -> offset 2
      // - 24 hrs (24 hrs) -> offset 1
      
      const sendReminder = async (label, offset) => {
        console.log(`🔔 Sending ${label} reminder for task: ${task.title}`);

        // 1. Send notification to the assigned employees
        if (Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
          for (const empId of task.assignedTo) {
            const empNotification = await Notification.create({
              title: "Task Deadline Reminder",
              body: `Your assigned task "${task.title}" is due in ${label}. Deadline: ${new Date(task.dueDate).toLocaleString('en-IN')}`,
              category: "Task",
              priority: "High",
              allUsers: false,
              users: [{ userId: empId }],
              userCount: 1,
              status: "sent"
            });

            // Emit socket event to the specific employee Room
            if (io) {
              try {
                io.to(`user:${empId}`).emit("new-notification", {
                  ...empNotification.toObject(),
                  isRead: false
                });
              } catch (socketErr) {
                console.error("Socket emit to employee failed:", socketErr);
              }
            }
          }
        }

        // 2. Send notification to Admins and Superadmins (using NotificationForAll)
        if (systemUser) {
          const adminNotification = await NotificationForAll.create({
            type: "TASK_DEADLINE_REMINDER",
            title: "Task Deadline Reminder",
            message: `The task "${task.title}" assigned to employees is due in ${label}. Deadline: ${new Date(task.dueDate).toLocaleString('en-IN')}`,
            module: "task",
            refId: task._id,
            createdByUser: systemUser._id,
            createdByRole: "system",
            visibleToRoles: ["admin", "superadmin"]
          });

          // Emit socket event to admin and superadmin roles
          if (io) {
            try {
              ["admin", "superadmin"].forEach((role) => {
                io.to(`role:${role}`).emit("new-notification", {
                  ...adminNotification.toObject(),
                  isRead: false
                });
              });
            } catch (socketErr) {
              console.error("Socket emit to roles failed:", socketErr);
            }
          }
        }
      };

      if (diffHours <= 24) {
        if (!sentOffsets.includes(1)) {
          await sendReminder("24 hours", 1);
          task.reminder_offsets_sent = [...new Set([...sentOffsets, 1, 2, 3])];
          shouldSave = true;
        }
      } else if (diffHours <= 48) {
        if (!sentOffsets.includes(2)) {
          await sendReminder("2 days", 2);
          task.reminder_offsets_sent = [...new Set([...sentOffsets, 2, 3])];
          shouldSave = true;
        }
      } else if (diffHours <= 72) {
        if (!sentOffsets.includes(3)) {
          await sendReminder("3 days", 3);
          task.reminder_offsets_sent = [...new Set([...sentOffsets, 3])];
          shouldSave = true;
        }
      }

      if (shouldSave) {
        await task.save();
      }
    }

    console.log("✅ Task Deadline Reminder Cron execution completed");
  } catch (error) {
    console.error("Task deadline reminder cron error:", error);
  }
};

// Run every hour if not in test environment
if (process.env.NODE_ENV !== "test") {
  cron.schedule("0 * * * *", runTaskDeadlineReminderJob);

  // Run also on startup to ensure reminders aren't missed
  setTimeout(runTaskDeadlineReminderJob, 5000);
}

module.exports = { runTaskDeadlineReminderJob };

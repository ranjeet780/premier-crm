const cron = require("node-cron");
const Task = require("../model/Task/Task");
const Notification = require("../model/Notification/Notification");
const NotificationForAll = require("../model/Notification/NotificationForAll");
const User = require("../model/Users/Users");
const { getIO } = require("../socket");

const runTaskDeadlineReminderJob = async () => {
  try {
    console.log("⏳ Running Task Deadline Reminder & Overdue Cron...");

    const now = new Date();

    const systemUser =
      (await User.findOne({ role: "superadmin" }).select("_id")) ||
      (await User.findOne().select("_id"));

    let io;
    try {
      io = getIO();
    } catch (err) {
      console.log("⚠️ Socket.IO not yet initialized, skipping real-time emits for now.");
    }

    // ==========================================
    // 1. UPCOMING DEADLINE REMINDERS (dueDate > now)
    // ==========================================
    const activeTasks = await Task.find({
      status: { $in: ["Pending", "In Progress"] },
      dueDate: { $gt: now },
    });

    for (const task of activeTasks) {
      const diffMs = new Date(task.dueDate) - now;
      const diffHours = diffMs / (1000 * 60 * 60);
      const sentOffsets = Array.isArray(task.reminder_offsets_sent)
        ? task.reminder_offsets_sent
        : [];
      let shouldSave = false;

      const sendReminder = async (label, offset) => {
        console.log(`🔔 Sending ${label} deadline reminder for task: ${task.title}`);

        // Notify assigned employees
        if (Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
          for (const empId of task.assignedTo) {
            const empNotification = await Notification.create({
              title: "Task Deadline Reminder",
              body: `Your assigned task "${task.title}" is due in ${label}. Deadline: ${new Date(
                task.dueDate
              ).toLocaleString("en-IN")}`,
              category: "Task",
              priority: "High",
              allUsers: false,
              users: [{ userId: empId }],
              userCount: 1,
              status: "sent",
            });

            if (io) {
              try {
                io.to(`user:${empId}`).emit("new-notification", {
                  ...empNotification.toObject(),
                  isRead: false,
                });
              } catch (socketErr) {
                console.error("Socket emit to employee failed:", socketErr);
              }
            }
          }
        }

        // Notify Admins and Superadmins
        if (systemUser) {
          const adminNotification = await NotificationForAll.create({
            type: "TASK_DEADLINE_REMINDER",
            title: "Task Deadline Reminder",
            message: `The task "${task.title}" assigned to employees is due in ${label}. Deadline: ${new Date(
              task.dueDate
            ).toLocaleString("en-IN")}`,
            module: "task",
            refId: task._id,
            createdByUser: systemUser._id,
            createdByRole: "system",
            visibleToRoles: ["admin", "superadmin"],
          });

          if (io) {
            try {
              ["admin", "superadmin"].forEach((role) => {
                io.to(`role:${role}`).emit("new-notification", {
                  ...adminNotification.toObject(),
                  isRead: false,
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

    // ==========================================
    // 2. OVERDUE TASK NOTIFICATIONS (dueDate <= now & not completed)
    // ==========================================
    const overdueTasks = await Task.find({
      status: { $in: ["Pending", "In Progress"] },
      dueDate: { $lte: now },
      overdueNotificationSent: { $ne: true },
    }).populate("assignedTo", "ename official_email personal_email");

    if (overdueTasks.length > 0) {
      console.log(`🚨 Found ${overdueTasks.length} overdue task(s). Sending notifications...`);
    }

    for (const task of overdueTasks) {
      console.log(`🚨 Task Overdue: "${task.title}" (Due Date: ${new Date(task.dueDate).toLocaleString('en-IN')})`);

      // Prepare employee names string
      let empNames = "Unassigned";
      if (Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
        empNames = task.assignedTo
          .map((emp) => emp.ename || emp.official_email || emp.personal_email || "Employee")
          .join(", ");
      }

      const formattedDueDate = new Date(task.dueDate).toLocaleString("en-IN");

      // 1. Notify Admin & SuperAdmin
      if (systemUser) {
        const adminNotification = await NotificationForAll.create({
          type: "TASK_OVERDUE",
          title: "🚨 Task Overdue Alert",
          message: `Task "${task.title}" assigned to ${empNames} was NOT completed on time! (Due Date: ${formattedDueDate})`,
          module: "task",
          refId: task._id,
          createdByUser: systemUser._id,
          createdByRole: "system",
          visibleToRoles: ["admin", "superadmin"],
        });

        if (io) {
          try {
            ["admin", "superadmin"].forEach((role) => {
              io.to(`role:${role}`).emit("new-notification", {
                ...adminNotification.toObject(),
                isRead: false,
              });
            });
          } catch (socketErr) {
            console.error("Socket emit for overdue alert failed:", socketErr);
          }
        }
      }

      // 2. Notify assigned Employee(s)
      if (Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
        for (const emp of task.assignedTo) {
          const empId = emp._id || emp;
          const empNotification = await Notification.create({
            title: "Task Overdue Notice",
            body: `Your assigned task "${task.title}" was due on ${formattedDueDate} and has not been marked as completed.`,
            category: "Task",
            priority: "High",
            allUsers: false,
            users: [{ userId: empId }],
            userCount: 1,
            status: "sent",
          });

          if (io) {
            try {
              io.to(`user:${empId}`).emit("new-notification", {
                ...empNotification.toObject(),
                isRead: false,
              });
            } catch (socketErr) {
              console.error("Socket emit to employee failed:", socketErr);
            }
          }
        }
      }

      // Mark overdue notification as sent for this task
      task.overdueNotificationSent = true;
      await task.save();
    }

    console.log("✅ Task Deadline Reminder & Overdue Cron execution completed");
  } catch (error) {
    console.error("Task deadline reminder & overdue cron error:", error);
  }
};

// Run every 15 minutes if not in test environment
if (process.env.NODE_ENV !== "test") {
  cron.schedule("*/15 * * * *", runTaskDeadlineReminderJob);

  // Run also on startup to ensure overdue notifications aren't missed
  setTimeout(runTaskDeadlineReminderJob, 5000);
}

module.exports = { runTaskDeadlineReminderJob };

// cronJobs/attendanceCron.js
const cron = require('node-cron');
const SignUp = require("../model/SignUp/SignUp");
const Attendance = require("../model/Attendance/Attendance");
const Leave = require("../model/userPannel/Leaves/Leaves");
const Holiday = require("../model/Holiday/Holiday");
const Notification = require("../model/Notification/Notification");
const NotificationForAll = require("../model/Notification/NotificationForAll");
const { getIO } = require("../socket");
const { formatDateIST, formatTime, parseISTLocalToUTC } = require("../utils/dateUtils");

async function propagateHolidayToAttendance(dateOnly, holidayObj) {
  const employees = await SignUp.find({ isActive: true });

  for (const emp of employees) {
    const existing = await Attendance.findOne({ empId: emp._id, date: dateOnly });
    if (existing) {
      // If existing is Absent/Present, convert to Holiday only if admin wants to override
      // Here we will set status to Holiday only if not Leave (leave should stay)
      if (existing.status !== "Leave") {
        existing.status = "Holiday";
        existing.remark = `Holiday: ${holidayObj.title || "Holiday (admin)"}`;
        existing.deductionAmount = 0;
        existing.isAutoMarkedAbsent = false;
        await existing.save();
      }
    } else {
      const a = new Attendance({
        empId: emp._id,
        date: dateOnly,
        status: "Holiday",
        remark: `Holiday: ${holidayObj.title || "Holiday (admin)"}`
      });
      await a.save();
    }
  }
}

// Cron: every 15 minutes — mark absent after officeEnd passes, skip leaves and holidays
cron.schedule('*/15 * * * *', async () => {
  try {
    const now = new Date();
    const dateStr = formatDateIST(now);
    const dateOnly = parseISTLocalToUTC(dateStr, "00:00:00");

    // 1) If admin added a holiday today, propagate it
    const todaysHoliday = await Holiday.findOne({ date: dateOnly });
    if (todaysHoliday) {
      await propagateHolidayToAttendance(dateOnly, todaysHoliday);
      // we still continue to next step (no marking absent for holidays)
    }

    // 2) Get all active employees
    const employees = await SignUp.find({ isActive: true });

    for (const emp of employees) {
      // if holiday for date, skip
      const holiday = await Holiday.findOne({ date: dateOnly });
      if (holiday) continue;

      // If there is an approved leave for today, skip (leave will be created if needed)
      const leave = await Leave.findOne({
        employeeId: emp._id,
        status: "Approved",
        from_date: { $lte: dateOnly },
        to_date: { $gte: dateOnly }
      });
      if (leave) {
        // create attendance as Leave if not exists
        const existing = await Attendance.findOne({ empId: emp._id, date: dateOnly });
        if (!existing) {
          const a = new Attendance({
            empId: emp._id,
            date: dateOnly,
            status: "Leave",
            remark: "Auto-created from approved leave",
          });
          await a.save();
        }
        continue;
      }

      // check officeEnd passed?
      const officeEnd = emp.officeEnd || "18:30";
      const officeEndDt = parseISTLocalToUTC(dateStr, `${officeEnd}:00`);
      if (now < officeEndDt) continue; // still office hours

      // now office ended for this employee; if attendance not present, mark Absent
      const att = await Attendance.findOne({ empId: emp._id, date: dateOnly });
      if (!att) {
        const absentAttendance = new Attendance({
          empId: emp._id,
          date: dateOnly,
          status: "Absent",
          isAutoMarkedAbsent: true,
          remark: "Auto-absent marked by cron"
        });
        try {
          await absentAttendance.save();
        } catch (err) {
          // unique index may throw if simultaneously created; ignore
        }
      }
    }
  } catch (err) {
    console.error("Attendance cron error:", err);
  }
}, {
  timezone: "Asia/Kolkata"
});

// Cron: every 1 minute — check for employees on break for > 40 minutes, auto-logout, and notify administrators
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    // Find all active attendance records where breakStatus is "On Break" and currentBreakStartRaw exists
    const activeBreaks = await Attendance.find({
      breakStatus: "On Break",
      currentBreakStartRaw: { $ne: null }
    }).populate("empId");

    for (const att of activeBreaks) {
      if (!att.empId) continue;

      const breakStart = new Date(att.currentBreakStartRaw);
      const elapsedMinutes = (now.getTime() - breakStart.getTime()) / (1000 * 60);

      // Exceeded 40 minutes?
      if (elapsedMinutes > 40) {
        console.log(`[Auto-Logout Triggered] Employee ${att.empId.ename} has been on break for ${elapsedMinutes.toFixed(2)} mins. Logging out.`);

        // 1. End active break session
        const durationMinutes = elapsedMinutes;
        const endStr = formatTime(now);

        att.breaks.push({
          start: att.breakStart,
          end: endStr,
          duration: Number(durationMinutes.toFixed(2))
        });

        att.totalBreakDuration = (att.totalBreakDuration || 0) + durationMinutes;
        att.workingHours = (att.workingHours || 0) + (durationMinutes / 60);

        att.breakEnd = endStr;
        att.currentBreakStartRaw = null;
        att.breakStatus = "Working"; // set back to Working internally

        // 2. Perform checkout (auto logout)
        att.check_out = endStr;
        att.remark = (att.remark ? att.remark + " | " : "") + "Auto-logged out: break exceeded 40 minutes limit.";
        await att.save();

        // 3. Prepare display values
        // Parse IST times for the notification body (India timezone has UTC+5:30)
        const breakStartIST = new Date(breakStart.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().replace("T", " ").slice(0, 19);
        const logoutTimeIST = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().replace("T", " ").slice(0, 19);
        const durationStr = `${durationMinutes.toFixed(1)} mins`;

        // 4. Find a system/admin user to act as creator of notifications
        const systemAdmin = await SignUp.findOne({ role: "superadmin" }) || await SignUp.findOne({ role: "admin" }) || att.empId;

        // 5. Create notification in NotificationForAll (for administrative users dashboard)
        const adminNotification = await NotificationForAll.create({
          type: "BREAK_EXCEEDED_AUTO_LOGOUT",
          title: "Break Exceeded - Auto Logout",
          message: `Employee ${att.empId.ename} exceeded the maximum allowed break time (40 mins). Break Start: ${breakStartIST}, Total Duration: ${durationStr}, Logout Timestamp: ${logoutTimeIST}`,
          module: "attendance",
          refId: att._id,
          createdByUser: systemAdmin._id,
          createdByRole: "system",
          visibleToRoles: ["admin", "superadmin"]
        });

        // 6. Create notification in Notification (for SystemNotificationBell and NavbarNotification admins)
        const globalNotification = await Notification.create({
          title: "Break Exceeded - Auto Logout",
          body: `Employee ${att.empId.ename} exceeded the maximum allowed break time (40 mins). Break Start: ${breakStartIST}, Total Duration: ${durationStr}, Logout Timestamp: ${logoutTimeIST}`,
          category: "Alert",
          priority: "High",
          allUsers: true,
          status: "sent"
        });

        // 7. Socket.IO emissions
        let io;
        try {
          io = getIO();
        } catch (socketErr) {
          console.warn("Socket.io not initialized yet, skipping real-time notifications");
        }

        if (io) {
          // Send notification to all admin/superadmin roles
          ["admin", "superadmin"].forEach((role) => {
            io.to(`role:${role}`).emit("new-notification", {
              ...adminNotification.toObject(),
              isRead: false
            });
            // Also notify the active admin channel namespace
            io.to("admins").emit("new-notification", {
              ...adminNotification.toObject(),
              isRead: false
            });
          });

          // Force logout the active employee client session
          io.to(`user:${att.empId._id}`).emit("force-logout", {
            reason: "Your break exceeded 40 minutes, and you have been automatically logged out."
          });
        }
      }
    }
  } catch (err) {
    console.error("Error in break checking cron job:", err);
  }
}, {
  timezone: "Asia/Kolkata"
});

module.exports = {}; // nothing to export, started by requiring this file


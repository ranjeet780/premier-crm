// cronJobs/attendanceCron.js
const cron = require('node-cron');
const SignUp = require("../model/SignUp/SignUp");
const Attendance = require("../model/Attendance/Attendance");
const Leave = require("../model/userPannel/Leaves/Leaves");
const Holiday = require("../model/Holiday/Holiday");

function getISTDate() {
  const dateIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  return new Date(dateIST);
}

function formatDate(date) {
  const d = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return d.toISOString().split("T")[0];
}

function hhmmToISTDate(dateStr /* "YYYY-MM-DD" */, hhmm /* "09:30" */) {
  const [h, m] = hhmm.split(':').map(Number);
  const dt = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
  const inst = new Date(dt.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return inst;
}

async function propagateHolidayToAttendance(holidayDate, holidayObj) {
  const dateOnly = new Date(holidayDate);
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
    const nowIST = getISTDate();
    const dateStr = formatDate(nowIST);
    const dateOnly = new Date(dateStr);

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
      const officeEndDt = hhmmToISTDate(dateStr, officeEnd);
      if (nowIST < officeEndDt) continue; // still office hours

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

module.exports = {}; // nothing to export, started by requiring this file

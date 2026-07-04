const cron = require("node-cron");
const Attendance = require("../model/Attendance/Attendance");
const SignUp = require("../model/SignUp/SignUp");
const { formatDateIST, parseISTLocalToUTC } = require("../utils/dateUtils");

cron.schedule("59 23 * * *", async () => {
  try {
    console.log("⏳ Running Auto-Absent Cron...");

    const now = new Date();
    const dateStr = formatDateIST(now);
    const dateOnly = parseISTLocalToUTC(dateStr, "00:00:00");

    const employees = await SignUp.find({ isActive: true });

    for (let emp of employees) {
      const check = await Attendance.findOne({
        empId: emp._id,
        date: dateOnly
      });

      // If employee has NO attendance record → Absent
      if (!check) {
        await Attendance.create({
          empId: emp._id,
          date: dateOnly,
          status: "Absent",
          remark: "Auto Absent"
        });

        console.log(`❌ Marked Absent: ${emp.ename}`);
      }
    }

    console.log("✅ Auto-Absent Completed");

  } catch (err) {
    console.log("Cron Error:", err);
  }
});

module.exports = {};


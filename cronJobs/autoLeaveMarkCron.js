const cron = require("node-cron");
const Leave = require("../model/userPannel/Leaves/Leaves");
const Attendance = require("../model/Attendance/Attendance");
const { formatDateIST, parseISTLocalToUTC } = require("../utils/dateUtils");

cron.schedule("10 0 * * *", async () => {
  try {
    const now = new Date();
    const dateStr = formatDateIST(now);
    const dateOnly = parseISTLocalToUTC(dateStr, "00:00:00");

    const leaves = await Leave.find({
      status: "Approved",
      from_date: { $lte: dateOnly },
      to_date: { $gte: dateOnly }
    });

    for (let l of leaves) {
      const exist = await Attendance.findOne({ empId: l.employeeId, date: dateOnly });

      if (!exist) {
        await Attendance.create({
          empId: l.employeeId,
          date: dateOnly,
          status: "Leave",
          remark: l.paid ? "Paid Leave" : "Unpaid Leave"
        });
      }
    }
  } catch (err) {
    console.error("Auto leave mark cron error:", err);
  }
});

module.exports = {};


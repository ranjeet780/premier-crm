const cron = require("node-cron");
const Leave = require("../model/userPannel/Leaves/Leaves");
const Attendance = require("../model/Attendance/Attendance");

cron.schedule("10 0 * * *", async () => {
  const today = new Date().toLocaleDateString("en-CA");

  const leaves = await Leave.find({
    status: "Approved",
    from_date: { $lte: today },
    to_date: { $gte: today }
  });

  for (let l of leaves) {
    const exist = await Attendance.findOne({ empId: l.employeeId, date: today });

    if (!exist) {
      await Attendance.create({
        empId: l.employeeId,
        date: today,
        status: "Leave",
        remark: l.paid ? "Paid Leave" : "Unpaid Leave"
      });
    }
  }
});

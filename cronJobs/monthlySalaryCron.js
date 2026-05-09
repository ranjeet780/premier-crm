const cron = require("node-cron");
const Attendance = require("../model/Attendance/Attendance");
const Leave = require("../model/userPannel/Leaves/Leaves");
const Salary = require("../model/userPannel/Salary/Salary");
const SignUp = require("../model/SignUp/SignUp");

async function generateSalaryForEmployee(employee, month, year) {
  const empId = employee._id;
  const basicPay = employee.givenSalary;
  const perDaySalary = basicPay / 30;

  // Attendance
  const attendance = await Attendance.find({
    empId,
    date: {
      $gte: new Date(`${year}-${month}-01`),
      $lte: new Date(`${year}-${month}-31`),
    },
  });

  let present = 0,
    absent = 0,
    halfDay = 0;

  attendance.forEach((a) => {
    if (a.status === "Present") present++;
    if (a.status === "Absent") absent++;
    if (a.status === "Half Day") halfDay++;
  });

  // Leaves
  const leaves = await Leave.find({
    employeeId: empId,
    status: "Approved",
    from_date: { $lte: new Date(`${year}-${month}-31`) },
    to_date: { $gte: new Date(`${year}-${month}-01`) },
  });

  let paidLeaves = 0,
    unpaidLeaves = 0;

  leaves.forEach((l) => {
    if (l.paid) paidLeaves += l.days;
    else unpaidLeaves += l.days;
  });

  // Deductions
  const absentDeduction = absent * perDaySalary;
  const halfDayDeduction = halfDay * (perDaySalary / 2);
  const unpaidLeaveDeduction = unpaidLeaves * perDaySalary;

  const totalDeductions =
    absentDeduction + halfDayDeduction + unpaidLeaveDeduction;

  const netPay = basicPay - totalDeductions;

  // Save salary
  await Salary.create({
    employeeId: empId,
    month,
    year,
    basicPay,
    allowances: 0,
    totalPresent: present,
    totalAbsent: absent,
    totalHalfDays: halfDay,
    paidLeaves,
    unpaidLeaves,
    perDaySalary,
    deductions: totalDeductions,
    netPay,
    status: "Paid",
  });
}

// CRON JOB — Runs every month on the 1st at 1:00 AM
cron.schedule("0 1 1 * *", async () => {
  try {
    console.log("🔄 Auto Salary Generation Started...");

    const employees = await SignUp.find({ isActive: true });

    // Previous Month Calculation
    const date = new Date();
    const year = date.getFullYear();
    const monthName = date.toLocaleString("default", { month: "long" });

    for (let emp of employees) {
      await generateSalaryForEmployee(emp, monthName, year);
      console.log(`✔ Salary generated for ${emp.ename}`);
    }

    console.log("🎉 Monthly Salary Auto-Generated Successfully!");
  } catch (error) {
    console.error("❌ Salary Cron Error:", error);
  }
});

module.exports = {};

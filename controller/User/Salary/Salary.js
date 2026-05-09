

// const Salary = require('../../../model/userPannel/Salary/Salary');
// const Leave = require('../../../model/userPannel/Leaves/Leaves');
// const Employee = require('../../../model/SignUp/SignUp');


// const getDaysInMonth = (monthName, year) => {
//   const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
//   return new Date(year, monthIndex + 1, 0).getDate();
// };

// const getMonthDateRange = (monthName, year) => {
//   const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
//   const start = new Date(year, monthIndex, 1);
//   const end = new Date(year, monthIndex + 1, 0);
//   return { start, end };
// };

// const getSalaryStats = async (req, res) => {
//   try {
//     const { employeeId, month, year } = req.params;

//     // 🧩 Check Employee
//     const emp = await Employee.findById(employeeId);
//     if (!emp) {
//       return res.status(404).json({ error: "Employee not found" });
//     }

//     const basicPay = Number(emp.givenSalary) || 0;
//     const allowances = Number(emp.allowances) || 0;
//     const totalSalary = basicPay + allowances;

//     const daysInMonth = getDaysInMonth(month, year);
//     const { start, end } = getMonthDateRange(month, year);

//     // 🧾 Fetch unpaid leaves for the given month/year
//     const leaves = await Leave.find({
//       employeeId,
//       leave_type: {
//         $in: [
//           "Unpaid",
//           "Unpaid Leave",
//           "Leave Without Pay",
//           "Loss of Pay",
//           "LOP",
//           "Without Pay",
//         ],
//       },
//       status: { $in: ["Approved", "approved", "Confirmed"] },
//       $or: [
//         { from_date: { $lte: end }, to_date: { $gte: start } }, // overlapping leaves
//       ],
//     });

//     // 📆 Count unpaid leave days within this month range
//     let unpaidLeaveDays = 0;
//     leaves.forEach((leave) => {
//       const from = new Date(leave.from_date) < start ? start : new Date(leave.from_date);
//       const to = new Date(leave.to_date) > end ? end : new Date(leave.to_date);
//       unpaidLeaveDays += Math.max(0, Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1);
//     });

//     // 💰 Salary Calculations
//     const deductionPerLeave = totalSalary / daysInMonth;
//     const totalDeductions = deductionPerLeave * unpaidLeaveDays;
//     const netPay = totalSalary - totalDeductions;

//     // ✅ Send Response
//     res.json([
//       {
//         employeeName: emp.ename,
//         month,
//         year,
//         basicPay,
//         allowances,
//         totalSalary: Number(totalSalary.toFixed(2)),
//         totalDeductions: Number(totalDeductions.toFixed(2)),
//         netPay: Number(netPay.toFixed(2)),
//         status: "Paid",
//         unpaidLeaveDays,
//       },
//     ]);
//   } catch (err) {
//     console.error("Error in getSalaryStats:", err);
//     res.status(500).json({ error: err.message });
//   }
// };



// // ==================== getSalaryDetails ====================

// const getSalaryDetails = async (req, res) => {
//   try {
//     const { employeeId, month = 'October', year = 2025 } = req.params;
//     const emp = await Employee.findById(employeeId);
//     if (!emp) return res.status(404).json({ message: 'Employee not found.' });

//     const basicPay = emp.givenSalary || 0;
//     const allowances = emp.allowances || 0;
//     const daysInMonth = getDaysInMonth(month, year);
//     const { start, end } = getMonthDateRange(month, year);

//     // Include all leave types (for record display)
//     const leaves = await Leave.find({
//       employeeId,
//       leave_type: {
//         $in: ["Unpaid", "LOP", "Leave Without Pay", "Casual Leave", "Sick Leave", "Earned Leave"]
//       },
//       status: { $in: ["Approved", "Pending"] },
//       $or: [{ from_date: { $lte: end }, to_date: { $gte: start } }]
//     });

//     let totalLeaveDays = 0;
//     leaves.forEach(leave => {
//       const from = leave.from_date < start ? start : leave.from_date;
//       const to = leave.to_date > end ? end : leave.to_date;
//       totalLeaveDays += Math.max(0, Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1);
//     });

//     const deductionPerLeave = basicPay / daysInMonth;
//     const totalDeductions = deductionPerLeave * totalLeaveDays;
//     const netPay = basicPay + allowances - totalDeductions;

//     res.json([{
//       month,
//       year: Number(year),
//       basicPay: Number(basicPay.toFixed(2)),
//       allowances: Number(allowances.toFixed(2)),
//       deductions: Number(totalDeductions.toFixed(2)),
//       netPay: Number(netPay.toFixed(2)),
//       status: "Paid"
//     }]);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// module.exports = { getSalaryStats, getSalaryDetails };

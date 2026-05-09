const Attendance = require("../../../model/Attendance/Attendance");
const Leave = require("../../../model/userPannel/Leaves/Leaves");
const Salary = require("../../../model/userPannel/Salary/Salary");
const SignUp = require("../../../model/SignUp/SignUp");
const SalaryAccessRequest = require('../../../model/userPannel/Salary/salaryAccessRequests')

const monthToNumber = {
  January: 1, February: 2, March: 3, April: 4,
  May: 5, June: 6, July: 7, August: 8,
  September: 9, October: 10, November: 11, December: 12
};


// ==========================================================
//  GENERATE SALARY
// ==========================================================


// const calculateSalary = ({ basicPay, perDaySalary, attendance, leaves }) => {
//   let present = 0;
//   let absent = 0;
//   let halfDay = 0;
//   let paidLeaves = 0;
//   let unpaidLeaves = 0;
//   let totalWorkingHours = 0;
//   let lateDays = 0;

//   // Calculate attendance
//   attendance.forEach((att) => {
//     if (att.status === "Present") {
//       present++;
//       totalWorkingHours += att.totalHours || 0;
//       if (att.isLate) lateDays++;
//     } else if (att.status === "Absent") {
//       absent++;
//     } else if (att.status === "Half Day") {
//       halfDay++;
//       totalWorkingHours += att.totalHours || 0;
//     }
//   });

//   // Calculate leaves
//   leaves.forEach((leave) => {
//     const from = new Date(leave.from_date);
//     const to = new Date(leave.to_date);
//     let days = 0;
//     for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
//       days++;
//     }
//     if (leave.leave_type === "Paid") {
//       paidLeaves += days;
//     } else {
//       unpaidLeaves += days;
//     }
//   });

//   // Deductions
//   const absentDeduction = absent * perDaySalary;
//   const halfDayDeduction = (halfDay / 2) * perDaySalary;
//   const unpaidLeaveDeduction = unpaidLeaves * perDaySalary;

//   // Late deduction (example: 10% of per day salary for each late day)
//   const lateDeduction = lateDays * (perDaySalary * 0.1);

//   const totalDeductions = absentDeduction + halfDayDeduction + unpaidLeaveDeduction + lateDeduction;
//   const netPay = basicPay - totalDeductions;

//   return {
//     present,
//     absent,
//     halfDay,
//     paidLeaves,
//     unpaidLeaves,
//     totalWorkingHours,
//     lateDays,
//     deductionDetails: {
//       absent: absentDeduction,
//       halfDay: halfDayDeduction,
//       unpaidLeave: unpaidLeaveDeduction,
//       late: lateDeduction,
//     },
//     totalDeductions,
//     netPay,
//   };
// };
const calculateSalary = ({
  basicPay = 0,
  perDaySalary = 0,
  attendance = [],
  leaves = [],
}) => {
  let present = 0;
  let absent = 0;
  let halfDay = 0;
  let paidLeaves = 0;
  let unpaidLeaves = 0;
  let totalWorkingHours = 0;
  let lateDays = 0;

  // ---- Attendance Calculation ----
  attendance.forEach((att) => {
    if (att.status === "Present") {
      present++;
      totalWorkingHours += att.totalHours || 0;
      if (att.isLate) lateDays++;
    } 
    else if (att.status === "Absent") {
      absent++;
    } 
    else if (att.status === "Half Day") {
      halfDay++;
      totalWorkingHours += att.totalHours || 0;
    }
  });

  // ---- Leave Calculation ----
  leaves.forEach((leave) => {
    const from = new Date(leave.from_date);
    const to = new Date(leave.to_date);

    const diffTime = Math.abs(to - from);
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (leave.leave_type === "Paid") {
      paidLeaves += days;
    } else {
      unpaidLeaves += days;
    }
  });

  // ---- Deductions ----
  const absentDeduction = absent * perDaySalary;
  const halfDayDeduction = (halfDay * perDaySalary) / 2;
  const unpaidLeaveDeduction = unpaidLeaves * perDaySalary;
  const lateDeduction = lateDays * (perDaySalary * 0.1);

  const totalDeductions =
    absentDeduction +
    halfDayDeduction +
    unpaidLeaveDeduction +
    lateDeduction;

  const netPay = Math.max(0, basicPay - totalDeductions);

  return {
    present,
    absent,
    halfDay,
    paidLeaves,
    unpaidLeaves,
    totalWorkingHours,
    lateDays,
    deductionDetails: {
      absent: absentDeduction,
      halfDay: halfDayDeduction,
      unpaidLeave: unpaidLeaveDeduction,
      late: lateDeduction,
    },
    totalDeductions,
    netPay,
  };
};

const generateSalary = async (req, res) => {
    try {
        const { empId } = req.params;
        const { month, year } = req.body;

        // Check if already exists
        const existing = await Salary.findOne({ employeeId: empId, month, year });
        if (existing) return res.status(400).json({ message: "Salary already generated for this month" });

        // Month name → number mapping
        const monthToNumber = {
            January: 1, February: 2, March: 3, April: 4,
            May: 5, June: 6, July: 7, August: 8,
            September: 9, October: 10, November: 11, December: 12
        };

        const m = monthToNumber[month];
        if (!m) return res.status(400).json({ message: "Invalid month format" });

        // Correct date range
        const from = new Date(year, m - 1, 1);      // e.g. 2025, 10, 1
        const to = new Date(year, m, 0);            // last day of this month

        // 1️⃣ Get employee
        const employee = await SignUp.findById(empId);
        if (!employee) return res.status(404).json({ message: "Employee not found" });

        const basicPay = employee.givenSalary || 0;
        const perDaySalary = basicPay / 30;

        // 2️⃣ Fetch Attendance (correct field is empId)
        const attendance = await Attendance.find({
            empId: empId,
            date: { $gte: from, $lte: to },
        });

        // 3️⃣ Fetch Leaves
        const leaves = await Leave.find({
            employeeId: empId,
            status: "Approved",
            from_date: { $lte: to },
            to_date: { $gte: from },
        });

        // 4️⃣ Calculate Salary
        const cal = calculateSalary({
            basicPay,
            perDaySalary,
            attendance,
            leaves,
        });

        // 5️⃣ Create Salary Record
        const salary = await Salary.create({
            employeeId: empId,
            employeeName: employee.ename,   // FIXED
            month,
            year,

            basicPay,
            perDaySalary,

            totalPresent: cal.present,
            totalAbsent: cal.absent,
            totalHalfDays: cal.halfDay,
            paidLeaves: cal.paidLeaves,
            unpaidLeaves: cal.unpaidLeaves,
            totalWorkingHours: cal.totalWorkingHours,
            lateDays: cal.lateDays,

            deductionDetails: cal.deductionDetails,
            deductions: cal.totalDeductions,
            netPay: cal.netPay,

            status: "Pending",
        });

        return res.json({
            message: "Salary generated successfully",
            salary,
        });

    } catch (error) {
        console.error("Generate Salary Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};




// ==========================================================
//  MANUAL RE-CALCULATION OF SALARY
// ==========================================================
const regenSalary = async (req, res) => {
    try {
        const { empId } = req.params;
        const { month, year } = req.body;

        await Salary.findOneAndDelete({
            employeeId: empId,
            month,
            year,
        });

        // Call generateSalary to create a new salary record
        // Note: generateSalary expects month and year in req.body
        req.body.month = month;
        req.body.year = year;
        return generateSalary(req, res);

    } catch (error) {
        console.error("Regen Salary Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};



const markSalaryPaid = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: "Salary ID missing" });
        }

        const updated = await Salary.findByIdAndUpdate(
            id,
            { status: "Paid" },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Salary record not found" });
        }

        res.json(updated);

    } catch (error) {
        console.error("Mark Paid Error:", error);
        res.status(500).json({ error: "Server Error" });
    }
};





// ==========================================================
//  GET SALARY BY MONTH FOR EMPLOYEE PANEL
// ==========================================================
const getSalaryByMonth = async (req, res) => {
  try {
    const { empId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and Year are required" });
    }

    // 1️⃣ Get salary for the month
      const salary = await Salary.findOne({
        employeeId: empId,
        month,
        year: Number(year)
      });

    // If salary is not accessible, return a placeholder
    if (salary && !salary.isAccessibleToEmployee) {
      return res.json({
        message: "Salary not accessible yet",
        summary: {
          totalSalary: 0,
          totalDeductions: 0,
          netPay: 0
        },
        attendanceSummary: null,
        deductionsBreakdown: null,
        salaryDetails: null
      });
    }

    if (!salary) {
      return res.json({
        message: "Salary not generated for this month",
        summary: {
          totalSalary: 0,
          totalDeductions: 0,
          netPay: 0
        },
        attendanceSummary: null,
        deductionsBreakdown: null,
        salaryDetails: null
      });
    }

    // 2️⃣ Summary
    const summary = {
      totalSalary: salary.basicPay,
      totalDeductions: salary.deductions,
      netPay: salary.netPay
    };

    // 3️⃣ Attendance Summary
    const attendanceSummary = {
      present: salary.totalPresent,
      absent: salary.totalAbsent,
      halfDay: salary.totalHalfDays,
      paidLeaves: salary.paidLeaves,
      unpaidLeaves: salary.unpaidLeaves,
      workingHours: salary.totalWorkingHours || "0",
      lateDays: salary.late || 0
    };

    // 4️⃣ Deduction Breakdown
    const deductionsBreakdown = {
      absentDeduction: salary.deductionDetails.absent,
      halfDayDeduction: salary.deductionDetails.halfDay,
      lateDeduction: salary.deductionDetails.late,
      unpaidLeaveDeduction: salary.deductionDetails.unpaidLeave
    };

    return res.json({
      summary,
      attendanceSummary,
      deductionsBreakdown,
      salaryDetails: salary
    });

  } catch (error) {
    console.log("Get Salary By Month Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getSalaryHistory = async (req, res) => {
    try {
        const { empId } = req.params;
        const { year } = req.query;

        const filter = { employeeId: empId };
        if (year) filter.year = Number(year);

        const history = await Salary.find(filter).sort({ createdAt: -1 });

        res.json(history);
    } catch (err) {
        console.log("Salary History Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
};




const requestAccess   = async (req, res) => {
  try {    const { empId } = req.params;
    const { month, year } = req.body;
    const request = await SalaryAccessRequest.create({
      employeeId: empId,
      month,
      year
    });


    return res.json({ message: "Request sent", request });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server Error" });
  }
};

// const approveAccess = async (req, res) => {
//   try {
//     const { requestId } = req.params;

//     const request = await SalaryAccessRequest.findByIdAndUpdate(
//       requestId,
//       { status: "Approved" },
//       { new: true }
//     );

//     // Make salary accessible
//     await Salary.updateOne(
//       { employeeId: request.employeeId, month: request.month, year: request.year },
//       { $set: { isAccessibleToEmployee: true } }
//     );

//     res.json({ message: "Access Approved", request });

//   } catch (err) {
//     res.status(500).json({ error: "Server Error" });
//   }
// };

// //admin contsuccessfully",
//       data: updated,
//     });
//   } catch (err) {
//     res.status(500).json({ msg: "Server error", error: err });
//   }
// };

// GET all salary rows + placeholder rows for employees with NO salary

const approveAccess = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await SalaryAccessRequest.findByIdAndUpdate(
      requestId,
      { status: "Approved" },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    // Make salary accessible
    await Salary.updateOne(
      {
        employeeId: request.employeeId,
        month: request.month,
        year: request.year
      },
      { $set: { isAccessibleToEmployee: true } }
    );

    res.json({
      message: "Access Approved Successfully",
      request
    });

  } catch (err) {
    res.status(500).json({ error: "Server Error", details: err.message });
  }
};


const getAllSalaries = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: "Month and Year required" });

    const employees = await SignUp.find({}, "ename employeeId givenSalary _id");

    const salaries = await Salary.find({ month, year })
       .populate("employeeId", "ename employeeId givenSalary");

    let rows = [];

    employees.forEach(emp => {
      const salary = salaries.find(s => String(s.employeeId._id) === String(emp._id));

      if (salary) {
        rows.push(salary); // existing salaries
      } else {
        rows.push({
          _isPlaceholder: true,
          employeeId: emp,
          month,
          year,
          status: "Not Generated",
        });
      }
    });

    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};




const bulkRegenerate = async (req, res) => {
    try {
        const { month, year } = req.body;

        const employees = await SignUp.find({});

        for (const emp of employees) {
            const fakeReq = {
                params: { empId: emp._id },
                body: { month, year },
            };

            await Salary.findOneAndDelete({
                employeeId: emp._id,
                month,
                year,
            });

            await generateSalary(fakeReq, { json: () => {} });
        }

        res.json({ message: "All salaries regenerated" });

    } catch (err) {
        console.log("Bulk Regenerate Error:", err);
        res.status(500).json({ error: "Failed to regenerate salaries" });
    }
};


// const calculateSalary = ({ basicPay, perDaySalary, attendance, leaves }) => {
//     let present = 0;
//     let absent = 0;
//     let halfDay = 0;
//     let late = 0;
//     let paidLeaves = 0;
//     let unpaidLeaves = 0;

//     attendance.forEach(a => {
//         const status = a.status.toLowerCase();
//         if (status === 'present') present++;
//         if (status === 'absent') absent++;
//         if (status.includes('half')) halfDay++;
//         if (a.isLateMinutes > 0) late++;
//     });

//     leaves.forEach(l => {
//         if (l.paid) paidLeaves += l.days;
//         else unpaidLeaves += l.days;
//     });

//     const deductionDetails = {
//         absent: absent * perDaySalary,
//         halfDay: halfDay * (perDaySalary / 2),
//         late: late * (perDaySalary * 0.1), // 10% of per day salary for each late day
//         unpaidLeave: unpaidLeaves * perDaySalary
//     };

//     const totalDeductions = Object.values(deductionDetails).reduce((sum, val) => sum + val, 0);
//     const netPay = basicPay - totalDeductions;

//     return {
//         present,
//         absent,
//         halfDay,
//         late,
//         paidLeaves,
//         unpaidLeaves,
//         deductionDetails,
//         totalDeductions,
//         netPay
//     };
// };

// const calculateSalary = ({
//     basicPay = 0,
//     perDaySalary = 0,
//     attendance = [],
//     leaves = []
// }) => {

//     let present = 0;
//     let absent = 0;
//     let halfDay = 0;
//     let late = 0;
//     let paidLeaves = 0;
//     let unpaidLeaves = 0;

//     // ---- Attendance ----
//     attendance.forEach(a => {
//         const status = (a.status || "").toLowerCase();

//         if (status === 'present') present++;
//         else if (status === 'absent') absent++;
//         else if (status.includes('half')) halfDay++;

//         if (a.isLateMinutes && a.isLateMinutes > 0) late++;
//     });

//     // ---- Leaves ----
//     leaves.forEach(l => {
//         if (l.paid) paidLeaves += l.days || 0;
//         else unpaidLeaves += l.days || 0;
//     });

//     // ---- Deductions ----
//     const deductionDetails = {
//         absent: absent * perDaySalary,
//         halfDay: halfDay * (perDaySalary / 2),
//         late: late * (perDaySalary * 0.1),
//         unpaidLeave: unpaidLeaves * perDaySalary
//     };

//     const totalDeductions = Object.values(deductionDetails)
//         .reduce((sum, val) => sum + val, 0);

//     const netPay = Math.max(0, basicPay - totalDeductions);

//     return {
//         present,
//         absent,
//         halfDay,
//         late,
//         paidLeaves,
//         unpaidLeaves,
//         deductionDetails,
//         totalDeductions,
//         netPay
//     };
// };


const getAllEmployeesWithSalary = async (req, res) => {
  try {
    const { month, year } = req.query;

    // Load ALL EMPLOYEES
    const employees = await SignUp.find({}, "ename employeeId givenSalary");

    let result = [];

    for (let emp of employees) {
      // Check salary for this month/year
      const salary = await Salary.findOne({
        employeeId: emp._id,
        month,
        year
      });

      if (salary) {
        result.push({
          ...salary.toObject(),
          employeeName: emp.ename,
          empCode: emp.employeeId,
        });
      } else {
        // Return "Not Generated" row
        result.push({
          employeeId: emp._id,
          employeeName: emp.ename,
          empCode: emp.employeeId,
          month,
          year,
          basicPay: emp.givenSalary,
          attendance: null,
          netPay: null,
          status: "Not Generated",
        });
      }
    }

    res.json(result);

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


const adminGetAllSalary = async (req, res) => {
    try {
        const { month, year } = req.query;

        // 1️⃣ Get ALL employees
        const employees = await SignUp.find().select(
            "ename employeeId givenSalary"
        );

        let finalData = [];

        for (let emp of employees) {
            // 2️⃣ Find salary for this employee for selected month/year
            const salary = await Salary.findOne({
                employeeId: emp._id,
                month,
                year,
            });

            finalData.push({
                employeeDbId: emp._id,
                name: emp.ename,
                code: emp.employeeId,
                basicPay: emp.givenSalary,
                salary: salary || null,
            });
        }

        res.json(finalData);

    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Server error" });
    }
};


const getAllEmployeeSalary = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and Year required" });
    }

    // 1️⃣ Fetch all employees
    const employees = await SignUp.find({}, "ename employeeId givenSalary");

    // 2️⃣ Fetch Salary only for month+year
    const salaries = await Salary.find({ month, year });

    // Convert salary array → object for quick lookup
    const salaryMap = {};
    salaries.forEach(s => {
      salaryMap[s.employeeId] = s;
    });

    // 3️⃣ Merge Employees + Salary
    const finalList = employees.map(emp => {
      const sal = salaryMap[emp._id]; // match with employeeId

      return {
        empDbId: emp._id,                         // Mongo ID
        employeeName: emp.ename,
        employeeCode: emp.employeeId,
        basicPay: emp.givenSalary,

        // If salary exists → data else defaults
        month,
        year,
        totalPresent: sal?.totalPresent || 0,
        totalAbsent: sal?.totalAbsent || 0,
        totalHalfDays: sal?.totalHalfDays || 0,
        paidLeaves: sal?.paidLeaves || 0,
        unpaidLeaves: sal?.unpaidLeaves || 0,
        deductions: sal?.deductions || 0,

        netPay: sal?.netPay || 0,
        attendance: sal ? true : false,
        status: sal ? sal.status : "Not Generated",
        salaryId: sal?._id || null
      };
    });

    res.json(finalList);

  } catch (err) {
    console.error("Salary fetch error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};



// EXPORT ALL
const regenerateSalary = async (req, res) => {
    try {
        const { empId } = req.params;
        const { month, year } = req.body;

        await Salary.findOneAndDelete({
            employeeId: empId,
            month,
            year,
        });

        // Call generateSalary to create a new salary record
        // Note: generateSalary expects month and year in req.body
        req.body.month = month;
        req.body.year = year;
        return generateSalary(req, res);

    } catch (error) {
        console.error("Regen Salary Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = {
  generateSalary,
  bulkRegenerate,
  getAllSalaries , 
  regenSalary,
  getAllEmployeesWithSalary,
  getSalaryByMonth,
  getSalaryHistory,
  requestAccess,
  approveAccess,
  regenerateSalary,
  markSalaryPaid,
  getAllEmployeeSalary,
  adminGetAllSalary
};
 

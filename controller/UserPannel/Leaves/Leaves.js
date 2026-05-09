const mongoose = require("mongoose");
const Leave = require("../../../model/userPannel/Leaves/Leaves");
const SignUp = require("../../../model/SignUp/SignUp");

/* -------------------------------------------
   ADD LEAVE (Employee Apply Leave)
-------------------------------------------- */


const addLeave = async (req, res) => {
  try {
    const {
      employeeId,
      leave_type,      
      leave_category,  
      from_date,
      to_date,
      reason
    } = req.body;

    if (!employeeId || !leave_type || !from_date || !to_date || !reason) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Detect objectId or plain employeeId string
    const isObjectId = mongoose.Types.ObjectId.isValid(employeeId);

    const emp = isObjectId
      ? await SignUp.findById(employeeId)
      : await SignUp.findOne({ employeeId });

    if (!emp) return res.status(404).json({ message: "Employee not found" });

    // --------------------------------------------------------------------
    // ⭐ FIX: Convert DD/MM/YYYY → YYYY-MM-DD
    // --------------------------------------------------------------------
    function parseDate(d) {
      if (typeof d === "string" && d.includes("/")) {
        // d = "16/11/2025"
        const [day, month, year] = d.split("/");
        return new Date(`${year}-${month}-${day}`);
      }
      return new Date(d);
    }

    const start = parseDate(from_date);
    const end = parseDate(to_date);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    if (end < start) {
      return res.status(400).json({ message: "Invalid date range" });
    }

    // Prevent overlapping leave ranges
    const overlap = await Leave.findOne({
      employeeId: emp._id,
      $or: [
        { from_date: { $lte: end }, to_date: { $gte: start } },
      ],
    });

    if (overlap) {
      return res.status(409).json({
        message: "Leave already applied for these date(s)",
      });
    }

    // Calculate leave days
    let days = 1;
    if (leave_type === "Half Day") {
      days = 0.5;
    } else {
      days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    }

    // CHECK EMPLOYEE SENIORITY
    const joiningDate = new Date(emp.joiningDate);
    const today = new Date();

    const diffMonths =
      (today.getFullYear() - joiningDate.getFullYear()) * 12 +
      (today.getMonth() - joiningDate.getMonth());

    let paid = false;

    if (diffMonths >= 3) {
      const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const paidLeavesThisMonth = await Leave.countDocuments({
        employeeId: emp._id,
        paid: true,
        from_date: { $gte: startMonth, $lte: endMonth },
      });

      // Only 1 paid leave allowed per month
      paid = paidLeavesThisMonth < 1;
    }

    // CREATE LEAVE ENTRY
    const leave = new Leave({
      employeeId: emp._id,
      leave_type,
      leave_category,
      from_date: start,
      to_date: end,
      reason,
      days,
      isHalfDay: leave_type === "Half Day",
      paid,
      status: "Pending",
    });

    await leave.save();

    res.status(201).json({
      message: "Leave applied successfully",
      leave,
    });

  } catch (error) {
    console.error("Error in addLeave:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        message: "Leave ID conflict occurred. Please submit again.",
      });
    }

    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


/* -------------------------------------------
   GET ALL LEAVES FOR EMPLOYEE (Table)
-------------------------------------------- */
const getAllLeaves = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId)
      return res.status(400).json({ message: "employeeId is required" });

    const isObjectId = mongoose.Types.ObjectId.isValid(employeeId);

    const emp = isObjectId
      ? await SignUp.findById(employeeId)
      : await SignUp.findOne({ employeeId });

    if (!emp)
      return res.status(404).json({ message: "Employee not found" });

    // Always get latest first
    const leaves = await Leave.find({ employeeId: emp._id })
      .sort({ _id: -1 });

    res.json(leaves);
  } catch (error) {
    console.error("Error fetching leaves:", error);
    res.status(500).json({
      message: "Error fetching leaves",
      error: error.message,
    });
  }
};



/* -------------------------------------------
   GET LEAVE HISTORY (Full)
-------------------------------------------- */
const getLeaveHistory = async (req, res) => {
  try {
    const employeeId =
      req.params.employeeId ||
      req.query.employeeId ||
      req.user?.employeeId;

    if (!employeeId)
      return res.status(400).json({ message: "employeeId required" });

    const isObjectId = mongoose.Types.ObjectId.isValid(employeeId);

    const emp = isObjectId
      ? await SignUp.findById(employeeId)
      : await SignUp.findOne({ employeeId });

    if (!emp)
      return res.status(404).json({ message: "Employee not found" });

    const history = await Leave.find({ employeeId: emp._id }).sort({
      from_date: -1,
    });

    res.json(history);
  } catch (error) {
    console.error("Error fetching leave history:", error);
    res.status(500).json({
      message: "Error fetching leave history",
      error: error.message,
    });
  }
};


const getAllLeavesAdmin = async (req, res) => {
  try {
    const leaves = await Leave.find()
      .populate("employeeId")      // Get employee name, email, etc.
      .sort({ createdAt: -1 });    // Latest first

    res.status(200).json(leaves);

  } catch (err) {
    console.error("Admin Get All Leaves Error:", err);
    res.status(500).json({
      message: "Server error while fetching leaves",
      error: err.message,
    });
  }
};




/* -------------------------------------------
   MONTHLY APPROVED LEAVES (for Dashboard)
-------------------------------------------- */
const getMonthlyAcceptedLeaves = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const now = new Date();

    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const isObjectId = mongoose.Types.ObjectId.isValid(employeeId);

    const emp = isObjectId
      ? await SignUp.findById(employeeId)
      : await SignUp.findOne({ employeeId });

    if (!emp)
      return res.status(404).json({ message: "Employee not found" });

    const leaves = await Leave.find({
      employeeId: emp._id,
      status: "Approved",
      from_date: { $gte: startMonth, $lte: endMonth },
    });

    res.json(leaves);
  } catch (error) {
    console.error("Error fetching monthly leaves:", error);
    res.status(500).json({
      message: "Error fetching monthly leaves",
      error: error.message,
    });
  }
};


/* -------------------------------------------
   EXPORT (if needed)
-------------------------------------------- */
const exportLeaves = async (req, res) => {
  // optional export API (frontend export already works with XLSX)
};
// const updateLeaveStatus = async (req, res) => {
//   try {
//     const { status, paid } = req.body;

//     if (!["Approved", "Rejected", "Pending"].includes(status)) {
//       return res.status(400).json({ message: "Invalid status" });
//     }

//     const leave = await Leave.findByIdAndUpdate(
//       req.params.leaveId,
//       { status, paid },
//       { new: true }
//     );

//     if (!leave) return res.status(404).json({ message: "Leave not found" });

//     res.json({ success: true, leave });

//   } catch (err) {
//     res.status(500).json({ message: "Error updating leave" });
//   }
// };

const updateLeaveStatus = async (req, res) => {
  try {
    const { status, paid, adminNote } = req.body;   // ← added adminNote here

    if (!["Approved", "Rejected", "Pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const leave = await Leave.findByIdAndUpdate(
      req.params.leaveId,
      { status, paid, adminNote },   // ← save adminNote here
      { new: true }
    );

    if (!leave) return res.status(404).json({ message: "Leave not found" });

    res.json({ success: true, leave });

  } catch (err) {
    res.status(500).json({ message: "Error updating leave" });
  }
};


module.exports = {
  addLeave,
  getAllLeaves,
  getLeaveHistory,
  getMonthlyAcceptedLeaves,
  getAllLeavesAdmin,
  updateLeaveStatus
  // updateLeaveStatus,
};

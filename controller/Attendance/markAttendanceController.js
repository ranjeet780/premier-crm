const { markAttendanceOnLogin } = require("../UserLogin/attendanceService");
const SignUp = require("../../model/SignUp/SignUp"); // Assuming SignUp model contains employee details

const markAttendance = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const now = new Date();

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required." });
    }

    const employee = await SignUp.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    const result = await markAttendanceOnLogin(employee, now);

    if (result.status === "already_marked") {
      return res.status(200).json({ message: "Attendance already marked for today.", checkIn: result.checkIn });
    } else if (result.status === "not_marked_out_of_office_time") {
      return res.status(200).json({ message: "Attendance not marked as it's outside office hours.", checkIn: result.checkIn });
    } else if (result.status === "present") {
      return res.status(201).json({ message: "Attendance marked successfully.", checkIn: result.checkIn });
    }
  } catch (error) {
    console.error("Error marking attendance:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = { markAttendance };

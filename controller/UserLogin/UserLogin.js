

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const SignUp = require("../../model/SignUp/SignUp");
const Attendance = require("../../model/Attendance/Attendance");
const nodemailer = require("nodemailer");
const { markAttendanceCheckIn, markAttendanceCheckOut } = require("../Attendance/Attendance");
const { formatDateIST, formatTime, parseISTLocalToUTC } = require("../../utils/dateUtils");
const crypto = require("crypto");
const Holiday = require("../../model/Holiday/Holiday");
const Leave = require('../../model/userPannel/Leaves/Leaves');
const User = require("../../model/Users/Users");

const TIME_ZONE = "Asia/Kolkata";
const DEFAULT_OFFICE_START = "09:30";
const DEFAULT_OFFICE_END = "18:30";
const DEFAULT_GRACE_MINUTES = 10;
const DEFAULT_HALF_DAY_CUTOFF = "14:00";

/* ================= TIME HELPERS ================= */




function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}



function sendLoginResponse(res, emp, token, extra = {}) {
  return res.status(200).json({

    message: "Login success",
    token,
    employeeId: emp._id,
    ename: emp.ename,
    official_email: emp.official_email,
    role: emp.role,
    userType: emp.userType || "employee",
    screenshotInterval: emp.screenshotInterval || 300,
    inactivityTimeout: emp.inactivityTimeout || 300,
    ...extra,
  });
}

const UserLogin = async (req, res) => {
  try {
    const { official_email, password } = req.body;

    /* 1️⃣ AUTH */
    const emp = await SignUp.findOne({ official_email });
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    if (emp.isActive === false) {
      return res.status(403).json({
        message: "Your account is blocked. Please contact admin.",
      });
    }

    let ok = await bcrypt.compare(password, emp.password || "");
    if (!ok && emp.password && emp.password === password) {
      ok = true;
      try {
        const hashed = await bcrypt.hash(password, 10);
        await SignUp.findByIdAndUpdate(emp._id, { password: hashed });
      } catch (hErr) {
        console.error("Auto hash upgrade error:", hErr);
      }
    }
    if (!ok) return res.status(400).json({ message: "Invalid password" });

    /* 1.1️⃣ CHECK LOCKED STATUS */
    if (emp.isLocked) {
      if (!req.body.unlockOTP) {
        return res.status(423).json({
          message: "Account is locked due to inactivity. Please enter the unlock code from Admin.",
          isLocked: true
        });
      }
      if (req.body.unlockOTP !== emp.unlockOTP) {
        return res.status(400).json({ message: "Invalid unlock code" });
      }
      // If code matches, unlock account
      await SignUp.findByIdAndUpdate(emp._id, {
        isLocked: false,
        unlockOTP: null
      });
    }

    const token = jwt.sign(
      { id: emp._id, role: emp.role },
      process.env.JWT_SECRET || "TEMP_SECRET",
      { expiresIn: "1d" }
    );

    /* 2️⃣ DATE / TIME (IST) */
    const now = req.body.testDateTime
      ? new Date(req.body.testDateTime)
      : new Date();

    const dateKey = formatDateIST(now);
    const todayMidnight = parseISTLocalToUTC(dateKey, "00:00:00");
    const timeStr = formatTime(now); // HH:mm

    /* 3️⃣ SUNDAY */
    if (now.getDay() === 0) {
      await Attendance.findOneAndUpdate(
        { empId: emp._id, date: todayMidnight },
        {
          empId: emp._id,
          date: todayMidnight,
          status: "Holiday",
          remark: "Sunday",
        },
        { upsert: true }
      );

      return sendLoginResponse(res, emp, token, {
        attendanceStatus: "Holiday (Sunday)",
      });
    }

    /* 4️⃣ FESTIVAL HOLIDAY */
    const holiday = await Holiday.findOne({
      date: {
        $gte: todayMidnight,
        $lt: new Date(todayMidnight.getTime() + 86400000),
      },
    });

    if (holiday) {
      await Attendance.findOneAndUpdate(
        { empId: emp._id, date: todayMidnight },
        {
          empId: emp._id,
          date: todayMidnight,
          status: "Holiday",
          remark: holiday.title,
        },
        { upsert: true }
      );

      return sendLoginResponse(res, emp, token, {
        attendanceStatus: "Holiday",
      });
    }

    /* 5️⃣ APPROVED LEAVE */
    const leave = await Leave.findOne({
      employeeId: emp._id,
      status: "Approved",
      from_date: { $lte: todayMidnight },
      to_date: { $gte: todayMidnight },
    });

    /* 6️⃣ EXISTING ATTENDANCE (PREVENT DOUBLE LOGIN) */
    const existing = await Attendance.findOne({
      empId: emp._id,
      date: todayMidnight,
    });

    if (existing) {
      if (existing.check_out) {
        existing.check_out = null;
        await existing.save();
      }
      return sendLoginResponse(res, emp, token, {
        attendanceStatus: existing.status,
        check_in: existing.check_in,
        lateMinutes: existing.isLateMinutes || 0,
        message: "Attendance already marked for today",
      });
    }
    /* 7️⃣ OFFICE CONFIG (ADMIN OVERRIDABLE) */
    const officeStart = emp.officeStart || DEFAULT_OFFICE_START;
    const officeEnd = emp.officeEnd || DEFAULT_OFFICE_END;
    const graceMinutes =
      typeof emp.graceMinutes === "number"
        ? emp.graceMinutes
        : DEFAULT_GRACE_MINUTES;

    /* 8️⃣ TIME CALCULATIONS */
    const loginMinutes = toMinutes(timeStr);
    const officeStartMinutes = toMinutes(officeStart);
    const graceEndMinutes = officeStartMinutes + graceMinutes;
    const officeEndMinutes = toMinutes(officeEnd);
    const halfDayCutoffMinutes = toMinutes(DEFAULT_HALF_DAY_CUTOFF);

    let status = "Present";
    let lateMinutes = 0;

    /* 9️⃣ LEAVE LOGIC FIRST */
    if (leave) {
      if (leave.isHalfDay) {
        status = "Half Day";
      } else {
        status = leave.paid ? "Paid Leave" : "Unpaid Leave";
      }
    }

    /* 🔟 NO LEAVE → APPLY TIME RULES */
    else {
      if (loginMinutes <= graceEndMinutes) {
        status = "Present";
      } else if (loginMinutes <= halfDayCutoffMinutes) {
        status = "Present";
        lateMinutes = loginMinutes - graceEndMinutes;
      } else if (loginMinutes <= officeEndMinutes) {
        status = "Half Day";
        lateMinutes = loginMinutes - graceEndMinutes;
      } else {
        status = "Absent";
      }
    }

    /* 1️⃣1️⃣ SAVE ATTENDANCE */
    await Attendance.create({
      empId: emp._id,
      date: todayMidnight,
      check_in: timeStr,
      status,
      isLateMinutes: lateMinutes,
      officeStart,
      officeEnd,
      graceMinutes,
      dailyWorkingHours: emp.dailyWorkingHours,
    });

    /* 1️⃣2️⃣ FINAL RESPONSE */
    return sendLoginResponse(res, emp, token, {
      attendanceStatus: status,
      lateMinutes,
      check_in: timeStr,
    });

  } catch (err) {
    console.error("UserLogin error:", err);
    return res.status(500).json({
      message: "Login error",
      error: err.message,
    });
  }
};


/* =====================================================
  EMPLOYEE LOGOUT → CHECK-OUT ATTENDANCE
  ===================================================== */

const UserLogout = async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ message: "employeeId is required" });
    }

    const now = new Date();
    const dateKey = formatDateIST(now);
    const startOfDay = parseISTLocalToUTC(dateKey, "00:00:00");
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const attendance = await Attendance.findOne({
      empId: employeeId,
      date: { $gte: startOfDay, $lt: endOfDay },
    }).sort({ date: -1 });

    if (!attendance || !attendance.check_in) {
      return res.status(200).json({ message: "Logout success (no check-in found)" });
    }

    attendance.check_out = formatTime(now);

    await attendance.save();

    res.status(200).json({ message: "Logout success" });
  } catch (err) {
    res.status(500).json({ message: "Logout error", error: err.message });
  }
};



/* =====================================================
  CALCULATE WORKING HOURS
  ===================================================== */
function calculateWorkingHours(checkIn, checkOut, date) {
  const start = new Date(`${date} ${checkIn}`);
  const end = new Date(`${date} ${checkOut}`);
  let diff = (end - start) / (1000 * 60 * 60);
  return diff.toFixed(2);
}

/* =====================================================
  GET WORKING HOURS API
  ===================================================== */
const getWorkingHours = async (req, res) => {
  try {
    const { employeeId, date } = req.query; // date = "YYYY-MM-DD"
    if (!employeeId || !date) {
      return res.status(400).json({ message: "employeeId and date are required" });
    }

    // Match attendance by IST day range instead of exact Date equality.
    const startOfDay = parseISTLocalToUTC(date, "00:00:00");
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const attendance = await Attendance.findOne({
      empId: employeeId,
      date: { $gte: startOfDay, $lt: endOfDay },
    }).sort({ date: -1 });

    if (!attendance || !attendance.check_in) {
      return res.json({ check_in: null });
    }

    res.json({
      check_in: `${date}T${attendance.check_in}`,   // "YYYY-MM-DDTHH:mm:ss"
      officeStart: attendance.officeStart,
      officeEnd: attendance.officeEnd,
      dailyWorkingHours: attendance.dailyWorkingHours
    });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};


/* =====================================================
  FORGOT & RESET PASSWORD
  ===================================================== */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

function getFrontendBaseUrl() {
  const fromEnv = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") return "";
  return "http://localhost:3000";
}

const forgotPassword = async (req, res) => {
  try {
    const { official_email } = req.body;
    if (!official_email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const trimmedEmail = official_email.trim();
    const emailRegex = new RegExp(`^${trimmedEmail}$`, "i");

    let user = await SignUp.findOne({ official_email: emailRegex });
    let isUserCollection = false;

    if (!user) {
      user = await User.findOne({ email: emailRegex });
      isUserCollection = true;
    }

    if (!user) {
      return res.status(404).json({ message: "No account found with this email address." });
    }

    const token = crypto.randomBytes(20).toString("hex");
    const expires = new Date(Date.now() + 3600000); // 1 hour

    if (isUserCollection) {
      await User.updateOne(
        { _id: user._id },
        { $set: { resetPasswordToken: token, resetPasswordExpires: expires } }
      );
    } else {
      await SignUp.updateOne(
        { _id: user._id },
        { $set: { resetPasswordToken: token, resetPasswordExpires: expires } }
      );
    }

    const frontendBaseUrl = getFrontendBaseUrl();
    const link = `${frontendBaseUrl}/reset-password/${token}`;

    console.log(`🔑 Reset Password link generated for ${trimmedEmail}: ${link}`);

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: trimmedEmail,
        subject: "Reset Your Password - Premier Webtech",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #0d6efd;">Premier Webtech Password Reset</h2>
            <p>Hello,</p>
            <p>You requested to reset your password. Click the button below to set a new password:</p>
            <p style="margin: 20px 0;">
              <a href="${link}" style="background-color: #0d6efd; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${link}">${link}</a></p>
            <p style="color: #777; font-size: 12px; margin-top: 30px;">This link will expire in 1 hour. If you did not request a password reset, please ignore this email.</p>
          </div>
        `,
      });

      return res.json({ message: "Password reset link sent to your email!" });
    } catch (emailErr) {
      console.error("Nodemailer error sending reset email:", emailErr);
      // In dev mode, return the link in response if mail server fails
      return res.status(200).json({
        message: `Password reset link created! (Email dispatch issue: ${emailErr.message}). You can use this reset link directly:`,
        resetLink: link
      });
    }
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ message: "Error processing forgot password", error: err.message });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const token = req.params.token || req.body.token;
    const { newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    let user = await SignUp.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    let isUserCollection = false;

    if (!user) {
      user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
      });
      isUserCollection = true;
    }

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired password reset link." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    if (isUserCollection) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: { password: hashedPassword },
          $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 },
        }
      );
    } else {
      await SignUp.updateOne(
        { _id: user._id },
        {
          $set: { password: hashedPassword },
          $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 },
        }
      );
    }

    return res.json({ message: "Password reset successful! You can now log in with your new password." });
  } catch (err) {
    console.error("resetUserPassword error:", err);
    return res.status(500).json({ message: "Error resetting password", error: err.message });
  }
};

const lockUserByInactivity = async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) return res.status(400).json({ message: "employeeId is required" });

    // Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await SignUp.findByIdAndUpdate(employeeId, {
      $set: { isLocked: true, unlockOTP: code },
      $inc: { inactivityLogoutCount: 1 },
      $push: { inactivityHistory: new Date() }
    });

    res.json({ message: "User locked successfully" });
  } catch (err) {
    res.status(500).json({ message: "Lock error", error: err.message });
  }
};

const getLockedStatus = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const emp = await SignUp.findById(employeeId);
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    res.json({ isLocked: emp.isLocked });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};

const generateManualCode = async (req, res) => {
  try {
    const { employeeId } = req.body;
    console.log(" [DEBUG] generateManualCode called with employeeId:", employeeId);

    if (!employeeId) {
      console.log(" [DEBUG] employeeId is missing in request body");
      return res.status(400).json({ message: "employeeId is required" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(" [DEBUG] New code generated:", code);

    const updated = await SignUp.findByIdAndUpdate(employeeId, {
      $set: { isLocked: true, unlockOTP: code },
      $inc: { inactivityLogoutCount: 1 },
      $push: { inactivityHistory: new Date() }
    }, { new: true });

    if (!updated) {
      console.log(" [DEBUG] Employee not found in database for id:", employeeId);
      return res.status(404).json({ message: "Employee not found" });
    }

    console.log(" [DEBUG] Successfully updated employee. New Count:", updated.inactivityLogoutCount);
    res.json({ message: "Code generated successfully", code });
  } catch (err) {
    console.error(" [DEBUG] generateManualCode error:", err);
    res.status(500).json({ message: "Error generating code", error: err.message });
  }
};

module.exports = {
  UserLogin,
  UserLogout,
  getWorkingHours,
  forgotPassword,
  resetUserPassword,
  lockUserByInactivity,
  getLockedStatus,
  generateManualCode
};

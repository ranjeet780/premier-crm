
const Attendance = require('../../model/Attendance/Attendance');
const SignUp = require('../../model/SignUp/SignUp');
const Leave = require('../../model/userPannel/Leaves/Leaves');
const Holiday = require("../../model/Holiday/Holiday");
const mongoose = require('mongoose');
const { parseISTLocalToUTC, formatTime } = require('../../utils/dateUtils');

function getBreakDurationMinutes(startRaw, checkOutTimeStr) {
  if (!startRaw || !checkOutTimeStr) return 0;
  const [h, m, s] = checkOutTimeStr.split(":").map(Number);
  const checkOutDate = new Date(startRaw);
  checkOutDate.setHours(h, m || 0, s || 0, 0);
  const diffMs = checkOutDate.getTime() - new Date(startRaw).getTime();
  const minutes = Math.max(0, diffMs / (1000 * 60));
  return Number(minutes.toFixed(2));
}


/* ---------------------------
   markAttendanceCheckOut
----------------------------*/
const markAttendanceCheckOut = async (req, res) => {
  const emp = await SignUp.findById(req.body.employeeId);
  if (!emp) return res.status(404).json({ message: "Employee not found" });

  const now = new Date();
  const dateKey = formatDateIST(now);
  const startOfDay = parseISTLocalToUTC(dateKey, "00:00:00");
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  // ⭐ RULE 0: Prevent checkout on holiday
  const holiday = await Holiday.findOne({
    date: { $gte: startOfDay, $lt: endOfDay }
  });
  if (holiday) {
    return res.status(400).json({
      message: `Checkout not allowed — Today is a holiday (${holiday.title}).`,
      isHoliday: true
    });
  }

  const attendance = await Attendance.findOne({
    empId: emp._id,
    date: { $gte: startOfDay, $lt: endOfDay },
  });

  // RULE 3: Must check-in first
  if (!attendance || !attendance.check_in) {
    return res.status(400).json({ message: "You haven't checked in today" });
  }

  attendance.check_out = formatTime(now);

  await attendance.save();

  res.json({
    message: "Checkout successful",
    attendance,
  });
};



const TIME_ZONE = "Asia/Kolkata";
const MONTH_NAME_TO_NUMBER = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/* ---------------------------
   getTodayAttendance
----------------------------*/
const getTodayAttendance = async (req, res) => {
  try {
    const { employeeId } = req.query;
    if (!employeeId) return res.status(400).json({ message: 'employeeId required' });

    const nowKey = formatDateIST(new Date());
    const start = parseISTLocalToUTC(nowKey, '00:00:00');
    const end = parseISTLocalToUTC(nowKey, '23:59:59');

    const att = await Attendance.findOne({
      empId: employeeId,
      date: { $gte: start, $lte: end }
    }).lean();

    return res.json(att || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ---------------------------
   getMonthlyAttendance (per employee)
----------------------------*/
async function buildLeaveMapForEmployee(employeeId, start, end) {
  const leaves = await Leave.find({
    employeeId,
    status: "Approved",
    from_date: { $lte: end },
    to_date: { $gte: start },
  }).lean();

  const leaveMap = {};

  for (const lv of leaves) {
    let from = lv.from_date < start ? new Date(start) : new Date(lv.from_date);
    let to = lv.to_date > end ? new Date(end) : new Date(lv.to_date);

    for (let dt = new Date(from); dt <= to; dt.setDate(dt.getDate() + 1)) {
      const key = formatDateIST(dt);

      leaveMap[key] = {
        paid: !!lv.paid,
        isHalfDay: !!lv.isHalfDay,
        leave_type: lv.leave_type || "",
      };
    }
  }

  return leaveMap;
}

async function buildHolidaySet(start, end) {
  const holidays = await Holiday.find({
    date: { $gte: start, $lte: end },
  }).lean();

  const holidaySet = new Set();

  for (const h of holidays) {
    const key = formatDateIST(h.date);
    holidaySet.add(key);
  }

  return holidaySet;
}

function getMonthRange(month, year) {
  const m = Number(month);
  const y = Number(year);

  if (isNaN(m) || isNaN(y)) {
    throw new Error("Invalid month or year");
  }

  const startDate = new Date(y, m - 1, 1, 0, 0, 0);
  const endDate = new Date(y, m, 0, 23, 59, 59);

  return { startDate, endDate };
}

function normalizeMonth(monthInput) {
  if (monthInput === null || monthInput === undefined) return NaN;
  const raw = String(monthInput).trim();
  if (!raw) return NaN;
  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) return numeric;
  return MONTH_NAME_TO_NUMBER[raw.toLowerCase()] || NaN;
}

function datesArray(year, month) {
  const dates = [];
  const y = Number(year);
  const m = Number(month);

  const totalDays = new Date(y, m, 0).getDate();

  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(
      new Date(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00`)
        .toLocaleString("en-US", { timeZone: TIME_ZONE })
    );

    dates.push(formatDateIST(date)); // YYYY-MM-DD
  }

  return dates;
}
function formatDateIST(date) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return parsedDate.toLocaleDateString("en-CA", {
    timeZone: TIME_ZONE,
  });
}
const getMonthlyAttendance = async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;

    if (!employeeId || !month || !year)
      return res.status(400).json({ error: "Missing employeeId, month or year" });

    const emp = await SignUp.findById(employeeId).lean();
    if (!emp) return res.status(404).json({ error: "Employee not found" });

    // ✅ FIX #1: correct order (month, year)
    // ✅ FIX #2: correct destructuring names
    const normalizedMonth = normalizeMonth(month);
    const normalizedYear = Number(year);
    const { startDate, endDate } = getMonthRange(normalizedMonth, normalizedYear);

    const dateKeys = datesArray(normalizedYear, normalizedMonth);
    const todayKey = formatDateIST(new Date());

    const [attendanceRecords, leaveMap, holidaySet] = await Promise.all([
      Attendance.find({
        empId: employeeId,
        date: { $gte: startDate, $lte: endDate },
      }).lean(),

      buildLeaveMapForEmployee(employeeId, startDate, endDate),
      buildHolidaySet(startDate, endDate),
    ]);

    let recordMap = {};
    attendanceRecords.forEach((r) => {
      const key = formatDateIST(r.date);
      recordMap[key] = r;
    });

    let output = [];
    let summary = {
      present: 0,
      absent: 0,
      halfday: 0,
      holiday: 0,
      paidLeaves: 0,
      unpaidLeaves: 0,
      lateCount: 0,
      lateHours: 0,
      totalDeduction: 0,
    };

    for (const key of dateKeys) {
      const weekday = new Date(
        new Date(`${key}T00:00:00Z`).toLocaleString("en-US", { timeZone: TIME_ZONE })
      ).getDay();

      let row = {
        date: key,
        status: "-",
        check_in: null,
        check_out: null,
        workingHours: 0,
        isLateMinutes: 0,
      };

      const isSunday = weekday === 0;
      const isHoliday = holidaySet.has(key);
      const att = recordMap[key];
      const leaveInfo = leaveMap[key];

      // Leave should be visible as L for the leave dates (past/current/future),
      // so apply leave before future/attendance fallback handling.
      if (leaveInfo) {
        if (leaveInfo.isHalfDay) {
          row.status = "Half Day Leave";
          summary.halfday++;
        } else {
          row.status = leaveInfo.paid ? "Paid Leave" : "Unpaid Leave";
          leaveInfo.paid ? summary.paidLeaves++ : summary.unpaidLeaves++;
        }
        output.push(row);
        continue;
      }

      if (key > todayKey) {
        output.push(row);
        continue;
      }

      if (isSunday || isHoliday) {
        row.status = "Holiday";
        summary.holiday++;
        output.push(row);
        continue;
      }

      if (att) {
        // If a check-in exists, treat the day as present in dashboards even if
        // legacy status was saved as "Absent" by older cutoff rules.
        const effectiveStatus =
          att.check_in && (att.status || "").toLowerCase() === "absent"
            ? "Present"
            : att.status || "-";

        let workingHours = att.workingHours || 0;
        let totalBreakDuration = att.totalBreakDuration || 0;
        let breaks = att.breaks ? [...att.breaks] : [];
        let breakEnd = att.breakEnd;

        if (att.breakStatus === "On Break" && att.currentBreakStartRaw && att.check_out) {
          const lastBreakMinutes = getBreakDurationMinutes(att.currentBreakStartRaw, att.check_out);
          if (lastBreakMinutes > 0) {
            totalBreakDuration += lastBreakMinutes;
            workingHours += (lastBreakMinutes / 60);
            breaks.push({
              start: att.breakStart,
              end: att.check_out,
              duration: lastBreakMinutes
            });
            breakEnd = att.check_out;
          }
        }

        row.status = effectiveStatus;
        row.check_in = att.check_in;
        row.check_out = att.check_out;
        row.workingHours = Number(workingHours.toFixed(2));
        row.isLateMinutes = att.isLateMinutes || 0;
        row.breakStart = att.breakStart || null;
        row.breakEnd = breakEnd || null;
        row.totalBreakDuration = totalBreakDuration;
        row.breakStatus = att.breakStatus || "Working";
        row.breaks = breaks;

        const s = effectiveStatus.toLowerCase();
        if (s === "present") summary.present++;
        else if (s === "absent") summary.absent++;
        else if (s.includes("half")) summary.halfday++;
        else if (s.includes("paid")) summary.paidLeaves++;
        else if (s.includes("unpaid")) summary.unpaidLeaves++;

        if (row.isLateMinutes > 0) {
          summary.lateCount++;
          summary.lateHours += row.isLateMinutes / 60;
        }
      } else {
        row.status = "Absent";
        summary.absent++;
      }

      output.push(row);
    }

    summary.lateHours = Number(summary.lateHours.toFixed(2));
    summary.totalDeduction = Number(summary.totalDeduction.toFixed(2));

    res.json({ data: output, summary });

  } catch (err) {
    console.error("getMonthlyAttendance error:", err);
    res.status(500).json({ error: err.message });
  }
};


/* ---------------------------
   getMonthlyAttendanceByAdmin
----------------------------*/
// ADMIN – MONTHLY ATTENDANCE (MULTI EMPLOYEE)
const getMonthlyAttendanceByAdmin = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ error: "Missing month or year" });
    }

    const monthInt = Number(month);
    const yearInt = Number(year);

    const { startDate, endDate } = getMonthRange(monthInt, yearInt);
    const dateKeys = datesArray(yearInt, monthInt); // ["2025-12-01", "2025-12-02", ...]

    const todayKey = formatDateIST(new Date());

    // 1️⃣ Get employees
    const employees = await SignUp.find().lean();

    // 2️⃣ Fetch all attendance + holidays + leaves for month
    const [attendanceRecords, holidays, approvedLeaves] = await Promise.all([
      Attendance.find({ date: { $gte: startDate, $lte: endDate } }).lean(),
      Holiday.find({ date: { $gte: startDate, $lte: endDate } }).lean(),
      Leave.find({
        status: "Approved",
        from_date: { $lte: endDate },
        to_date: { $gte: startDate },
      }).lean(),
    ]);

    // Create holiday set
    const holidaySet = new Set(
      holidays.map((h) => formatDateIST(h.date))
    );

    // Group attendance by employee
    const attendanceMap = {};
    attendanceRecords.forEach(a => {
      const key = formatDateIST(a.date);
      const empKey = String(a.empId);
      if (!attendanceMap[empKey]) attendanceMap[empKey] = {};
      attendanceMap[empKey][key] = a;
    });

    // Group approved leaves by employee/date
    const leaveMap = {};
    approvedLeaves.forEach((lv) => {
      const empKey = String(lv.employeeId);
      if (!leaveMap[empKey]) leaveMap[empKey] = {};

      const from = lv.from_date < startDate ? new Date(startDate) : new Date(lv.from_date);
      const to = lv.to_date > endDate ? new Date(endDate) : new Date(lv.to_date);

      for (let dt = new Date(from); dt <= to; dt.setDate(dt.getDate() + 1)) {
        const leaveKey = formatDateIST(dt);
        leaveMap[empKey][leaveKey] = {
          paid: !!lv.paid,
          isHalfDay: !!lv.isHalfDay,
        };
      }
    });

    let finalResult = [];

    for (let emp of employees) {
      let output = [];
      let summary = {
        present: 0,
        absent: 0,
        halfday: 0,
        holiday: 0,
        paidLeaves: 0,
        unpaidLeaves: 0,
        lateCount: 0,
        lateHours: 0,
      };

      for (const key of dateKeys) {
        const weekday = new Date(
          new Date(`${key}T00:00:00Z`).toLocaleString("en-US", { timeZone: TIME_ZONE })
        ).getDay();

        let row = {
          date: key,
          status: "-",
          check_in: null,
          check_out: null,
          workingHours: 0,
          isLateMinutes: 0,
          lastActive: null
        };

        // FUTURE DATE
        if (key > todayKey) {
          output.push(row);
          continue;
        }

        const att = attendanceMap[String(emp._id)]?.[key];
        const leaveInfo = leaveMap[String(emp._id)]?.[key];

        const isSunday = weekday === 0;
        const isHoliday = holidaySet.has(key);

        // Leave should be visible as L for the leave dates (past/current/future),
        // so apply leave before future/attendance fallback handling.
        if (leaveInfo) {
          if (leaveInfo.isHalfDay) {
            row.status = "Half Day Leave";
            summary.halfday++;
          } else {
            row.status = leaveInfo.paid ? "Paid Leave" : "Unpaid Leave";
            leaveInfo.paid ? summary.paidLeaves++ : summary.unpaidLeaves++;
          }
          output.push(row);
          continue;
        }

        if (key > todayKey) {
          output.push(row);
          continue;
        }

        // SUNDAY / HOLIDAY
        if (isSunday || isHoliday) {
          row.status = "Holiday";
          summary.holiday++;
          output.push(row);
          continue;
        }

        if (att) {
          const effectiveStatus =
            att.check_in && (att.status || "").toLowerCase() === "absent"
              ? "Present"
              : att.status;

          let workingHours = att.workingHours || 0;
          let totalBreakDuration = att.totalBreakDuration || 0;
          let breaks = att.breaks ? [...att.breaks] : [];
          let breakEnd = att.breakEnd;

          if (att.breakStatus === "On Break" && att.currentBreakStartRaw && att.check_out) {
            const lastBreakMinutes = getBreakDurationMinutes(att.currentBreakStartRaw, att.check_out);
            if (lastBreakMinutes > 0) {
              totalBreakDuration += lastBreakMinutes;
              workingHours += (lastBreakMinutes / 60);
              breaks.push({
                start: att.breakStart,
                end: att.check_out,
                duration: lastBreakMinutes
              });
              breakEnd = att.check_out;
            }
          }

          row.status = effectiveStatus;
          row.check_in = att.check_in;
          row.check_out = att.check_out;
          row.workingHours = Number(workingHours.toFixed(2));
          row.isLateMinutes = att.isLateMinutes;
          row.lastActive = att.lastActive || null;
          row.breakStart = att.breakStart || null;
          row.breakEnd = breakEnd || null;
          row.totalBreakDuration = totalBreakDuration;
          row.breakStatus = att.breakStatus || "Working";
          row.breaks = breaks;

          const s = (effectiveStatus || '').toLowerCase();
          if (s === "present") summary.present++;
          else if (s === "absent") summary.absent++;
          else if (s === "half day") summary.halfday++;
          else if (s === "paid leave") summary.paidLeaves++;
          else if (s === "unpaid leave") summary.unpaidLeaves++;

          if (att.isLateMinutes > 0) {
            summary.lateCount++;
            summary.lateHours += att.isLateMinutes / 60;
          }

        } else {
          row.status = "Absent";
          summary.absent++;
        }

        output.push(row);
      }

      summary.lateHours = Number(summary.lateHours.toFixed(2));

      finalResult.push({
        empId: emp._id,
        ename: emp.ename,
        officeStart: emp.officeStart,
        officeEnd: emp.officeEnd,
        graceMinutes: emp.graceMinutes,
        dailyWorkingHours: emp.dailyWorkingHours,
        summary,
        attendance: output,
      });
    }

    res.json(finalResult);

  } catch (err) {
    console.error("Admin monthly attendance error:", err);
    res.status(500).json({ error: "Server error" });
  }
};


/* ---------------------------
   Admin update one employee office timing
----------------------------*/
async function adminUpdateOfficeTiming(req, res) {
  try {
    const { employeeId } = req.params;
    const { officeStart, officeEnd, graceMinutes, dailyWorkingHours, screenshotInterval, inactivityTimeout } = req.body;

    // 🔐 Only SuperAdmin (or Admin) can change these settings
    if (req.user?.role !== "superadmin" && req.user?.role !== "admin") {
       return res.status(403).json({ message: "Only Admin/SuperAdmin can change these settings" });
    }

    const emp = await SignUp.findById(employeeId);
    if (!emp) return res.status(404).json({ message: "Employee not found" });

    const updateFields = {};
    if (officeStart !== undefined) updateFields.officeStart = officeStart;
    if (officeEnd !== undefined) updateFields.officeEnd = officeEnd;
    if (graceMinutes !== undefined) updateFields.graceMinutes = graceMinutes;
    if (dailyWorkingHours !== undefined) updateFields.dailyWorkingHours = dailyWorkingHours;
    
    if (screenshotInterval !== undefined) {
      const val = parseInt(screenshotInterval);
      if (!isNaN(val)) updateFields.screenshotInterval = val;
    }
    
    if (inactivityTimeout !== undefined) {
      const val = parseInt(inactivityTimeout);
      if (!isNaN(val)) updateFields.inactivityTimeout = val;
    }

    const updatedEmp = await SignUp.findByIdAndUpdate(
      employeeId,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedEmp) {
      return res.status(404).json({ message: "Update failed" });
    }

    return res.json({ message: "Settings updated successfully", employee: updatedEmp });

  } catch (err) {
    console.error("adminUpdateOfficeTiming error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/* ---------------------------
   startBreak
----------------------------*/
const startBreak = async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) return res.status(400).json({ message: "employeeId is required" });

    const emp = await SignUp.findById(employeeId);
    if (!emp) return res.status(404).json({ message: "Employee not found" });

    const now = new Date();
    const dateKey = formatDateIST(now);
    const startOfDay = parseISTLocalToUTC(dateKey, "00:00:00");
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const attendance = await Attendance.findOne({
      empId: emp._id,
      date: { $gte: startOfDay, $lt: endOfDay }
    });

    if (!attendance || !attendance.check_in) {
      return res.status(400).json({ message: "You must check-in first before starting a break." });
    }

    if (attendance.breakStatus === "On Break") {
      return res.status(400).json({ message: "You are already on break." });
    }

    const timeStr = formatTime(now);
    attendance.breakStart = timeStr;
    attendance.currentBreakStartRaw = now;
    attendance.breakStatus = "On Break";

    await attendance.save();

    res.json({
      message: "Break started successfully",
      attendance
    });
  } catch (err) {
    console.error("startBreak error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ---------------------------
   resumeBreak
----------------------------*/
const resumeBreak = async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) return res.status(400).json({ message: "employeeId is required" });

    const emp = await SignUp.findById(employeeId);
    if (!emp) return res.status(404).json({ message: "Employee not found" });

    const now = new Date();
    const dateKey = formatDateIST(now);
    const startOfDay = parseISTLocalToUTC(dateKey, "00:00:00");
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const attendance = await Attendance.findOne({
      empId: emp._id,
      date: { $gte: startOfDay, $lt: endOfDay }
    });

    if (!attendance || !attendance.check_in) {
      return res.status(400).json({ message: "No active attendance session found." });
    }

    if (attendance.breakStatus !== "On Break" || !attendance.currentBreakStartRaw) {
      return res.status(400).json({ message: "You are not currently on break." });
    }

    const startRaw = new Date(attendance.currentBreakStartRaw);
    const durationMs = now.getTime() - startRaw.getTime();
    const durationMinutes = Math.max(0, durationMs / (1000 * 60));

    const endStr = formatTime(now);

    attendance.breaks.push({
      start: attendance.breakStart,
      end: endStr,
      duration: Number(durationMinutes.toFixed(2))
    });

    attendance.totalBreakDuration = (attendance.totalBreakDuration || 0) + durationMinutes;
    attendance.workingHours = (attendance.workingHours || 0) + (durationMinutes / 60);

    attendance.breakEnd = endStr;
    attendance.currentBreakStartRaw = null;
    attendance.breakStatus = "Working";

    await attendance.save();

    res.json({
      message: "Resumed work successfully",
      attendance
    });
  } catch (err) {
    console.error("resumeBreak error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  getMonthlyAttendanceByAdmin,

  markAttendanceCheckOut,
  getTodayAttendance,
  getMonthlyAttendance,
  adminUpdateOfficeTiming,
  startBreak,
  resumeBreak
};

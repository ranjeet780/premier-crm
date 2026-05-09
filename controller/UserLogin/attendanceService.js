const Attendance = require('../../model/Attendance/Attendance')
const { formatDateIST, formatTime, parseISTLocalToUTC } = require('../../utils/dateUtils');

async function markAttendanceOnLogin(employee, now) {
  const todayKey = formatDateIST(now);

  const officeStart = employee.officeStart || "09:30";
  const officeEnd = employee.officeEnd || "18:30";
  const timeStr = formatTime(now).slice(0, 5);

  if (timeStr < officeStart || timeStr > officeEnd) {
    return { status: "not_marked_out_of_office_time", checkIn: null };
  }

  const start = parseISTLocalToUTC(todayKey, "00:00:00");
  const end = parseISTLocalToUTC(todayKey, "23:59:59");

  const existing = await Attendance.findOne({
    empId: employee._id,
    date: { $gte: start, $lte: end }
  });

  if (existing && existing.check_in) {
    return {
      status: "already_marked",
      checkIn: `${todayKey}T${existing.check_in}`
    };
  }

  const attendance = new Attendance({
    empId: employee._id,
    date: start,
    check_in: formatTime(now),
    status: "Present"
  });

  await attendance.save();

  return {
    status: "present",
    checkIn: `${todayKey}T${attendance.check_in}`
  };
}

module.exports = { markAttendanceOnLogin };

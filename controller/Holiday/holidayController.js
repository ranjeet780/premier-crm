const Holiday = require("../../model/Holiday/Holiday");
const Attendance = require("../../model/Attendance/Attendance");
const SignUp = require("../../model/SignUp/SignUp");



function toDateOnly(d) {
  const { formatDateIST, parseISTLocalToUTC } = require("../../utils/dateUtils");
  const dateStr = formatDateIST(new Date(d));
  return parseISTLocalToUTC(dateStr, "00:00:00");
}

async function createHoliday(req, res) {
  try {
    const { date, title, description, isPaid } = req.body;

    const dateOnly = toDateOnly(new Date(date));

    // 1️⃣ Save holiday
    const holiday = await Holiday.create({
      date: dateOnly,
      title,
      description,
      isPaid
    });

    // 2️⃣ Fetch all employees
    const allEmployees = await SignUp.find({}, "_id");

    // 3️⃣ Mark holiday in Attendance (required to show ⭐)
    for (const emp of allEmployees) {
      await Attendance.findOneAndUpdate(
        { empId: emp._id, date: dateOnly },
        {
          status: "Holiday",
          check_in: null,
          check_out: null,
          isLateMinutes: 0
        },
        { upsert: true }
      );
    }

    res.json({
      message: "Holiday added & attendance updated for all employees.",
      holiday
    });
  } catch (err) {
    res.status(500).json({
      message: "Holiday creation error",
      error: err.message
    });
  }
}

// ----------------------------------------------------
// DELETE HOLIDAY
// ----------------------------------------------------
const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    const hol = await Holiday.findByIdAndDelete(id);
    if (!hol) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    // Remove holiday attendance
    await Attendance.updateMany(
      { date: hol.date, status: "Holiday" },
      { $set: { status: "Absent" } }
    );

    res.json({ message: "Holiday deleted and attendance updated" });

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ----------------------------------------------------
// GET ALL HOLIDAYS
// ----------------------------------------------------
const getAllHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.json(holidays);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
const isHoliday = async (req, res) => {
  try {
    const rawDate = req.query.date;
    const parsedDate = rawDate ? new Date(rawDate) : new Date();
    const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    const dateOnly = toDateOnly(safeDate);
    const nextDay = new Date(dateOnly);
    nextDay.setDate(nextDay.getDate() + 1);

    const holiday = await Holiday.findOne({
      date: { $gte: dateOnly, $lt: nextDay },
    });

    if (holiday) {
      return res.json({
        isHoliday: true,
        title: holiday.title,
        description: holiday.description
      });
    }

    res.json({ isHoliday: false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


module.exports = {
  isHoliday,
  createHoliday,
  deleteHoliday,
  getAllHolidays,
};

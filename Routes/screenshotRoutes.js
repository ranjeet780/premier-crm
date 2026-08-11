const express = require("express");
const router = express.Router();
const Screenshot = require("../model/ActivityLog/Screenshot");

function calculateLateMinutes(checkInTimeStr, officeStartStr = "09:30", graceMin = 10) {
  if (!checkInTimeStr) return 0;
  const [h, m] = String(checkInTimeStr).split(":").map(Number);
  const [startH, startM] = String(officeStartStr).split(":").map(Number);

  const checkInMins = h * 60 + (m || 0);
  const startMins = startH * 60 + (startM || 0);
  const graceEndMins = startMins + Number(graceMin || 10);

  if (checkInMins > graceEndMins) {
    return checkInMins - graceEndMins;
  }
  return 0;
}

// POST /api/screenshots/upload
// Expects: { employeeId, imageBuffer, currentRoute }
router.post("/upload", async (req, res) => {
  try {
    const { employeeId, imageBuffer, currentRoute, trackedSeconds } = req.body;

    if (!employeeId || !imageBuffer) {
      return res.status(400).json({
        success: false,
        message: "employeeId and imageBuffer are required fields."
      });
    }

    const newScreenshot = new Screenshot({
      employeeId,
      imageBuffer,
      currentRoute
    });

    await newScreenshot.save();

    // --- Update working hours for the day ---
    try {
      const { formatDateIST, parseISTLocalToUTC } = require("../utils/dateUtils");
      const Attendance = require("../model/Attendance/Attendance");

      const now = new Date();
      const dateKey = formatDateIST(now);
      const startOfDay = parseISTLocalToUTC(dateKey, "00:00:00");
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const SignUp = require("../model/SignUp/SignUp");
      const user = await SignUp.findById(employeeId);
      const intervalSec = user?.screenshotInterval || 300;

      let att = await Attendance.findOne({
        empId: employeeId,
        date: { $gte: startOfDay, $lt: endOfDay }
      });

      const { formatTime } = require("../utils/dateUtils");
      const timeStr = formatTime(now);

      if (!att) {
        att = new Attendance({
          empId: employeeId,
          date: startOfDay,
          check_in: timeStr,
          status: "Present",
          isAutoMarkedAbsent: false,
          officeStart: user?.officeStart || "09:30",
          officeEnd: user?.officeEnd || "18:30",
          graceMinutes: user?.graceMinutes || 10,
          dailyWorkingHours: user?.dailyWorkingHours,
        });
      }

      if (att) {
        if (!att.check_in || (att.status || "").toLowerCase() === "absent") {
          att.check_in = att.check_in || timeStr;
          att.status = "Present";
          att.isAutoMarkedAbsent = false;
        }

        const officeStart = att.officeStart || user?.officeStart || "09:30";
        const graceMinutes = typeof att.graceMinutes === "number" ? att.graceMinutes : (user?.graceMinutes || 10);
        att.isLateMinutes = calculateLateMinutes(att.check_in, officeStart, graceMinutes);

        // Increment working hours by actual tracked elapsed time, capped at interval + buffer
        let addedSec = trackedSeconds !== undefined && !isNaN(Number(trackedSeconds)) 
          ? Number(trackedSeconds) 
          : intervalSec;
        
        // 1. Cap added seconds to interval + 60s as a hard ceiling for anomalies
        let maxAllowedSec = intervalSec + 60;
        
        // 2. Prevent duplicate-tracking across multiple tabs by ensuring we never add more time 
        // than the actual physical time elapsed on the server since the last screenshot.
        if (att.lastActive) {
          const serverElapsedSec = (now.getTime() - new Date(att.lastActive).getTime()) / 1000;
          if (serverElapsedSec >= 0) {
            // Allow a small 5-second buffer for overlapping network latency
            const actualMax = serverElapsedSec + 5;
            if (actualMax < maxAllowedSec) {
               maxAllowedSec = actualMax;
            }
          }
        }

        // 3. Final capping
        addedSec = Math.max(0, Math.min(addedSec, maxAllowedSec));

        att.workingHours = (att.workingHours || 0) + (addedSec / 3600);
        att.lastActive = now;
        await att.save();
      }
    } catch (attError) {
      console.error("Failed to update attendance hours on screenshot upload:", attError);
    }

    return res.status(201).json({
      success: true,
      message: "Activity screenshot uploaded and stored in database successfully."
    });
  } catch (error) {
    console.error("Screenshot upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during screenshot upload.",
      error: error.message
    });
  }
});

// GET /api/screenshots/employee/:employeeId
// Optional Query Param: date (format: YYYY-MM-DD)
router.get("/employee/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { date } = req.query;

    let query = { employeeId };

    // If date filter is provided, filter screenshots strictly on that calendar day
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);

      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      query.createdAt = {
        $gte: start,
        $lte: end
      };
    }

    // Return the screenshots, sorted by time ascending (earliest to latest)
    // We only select the fields we need to optimize response sizes
    const screenshots = await Screenshot.find(query)
      .select("_id imageBuffer currentRoute createdAt")
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: screenshots.length,
      data: screenshots
    });
  } catch (error) {
    console.error("Screenshot fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during screenshot fetch.",
      error: error.message
    });
  }
});

// DELETE /api/screenshots/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Backend] Attempting to delete screenshot with ID: ${id}`);
    const deleted = await Screenshot.findByIdAndDelete(id);

    if (!deleted) {
      console.log(`[Backend] Screenshot not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: "Screenshot not found."
      });
    }

    console.log(`[Backend] Screenshot deleted successfully: ${id}`);
    return res.status(200).json({
      success: true,
      message: "Screenshot deleted successfully."
    });
  } catch (error) {
    console.error("Screenshot deletion error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during screenshot deletion.",
      error: error.message
    });
  }
});

module.exports = router;

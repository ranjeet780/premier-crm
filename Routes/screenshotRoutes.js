const express = require("express");
const router = express.Router();
const Screenshot = require("../model/ActivityLog/Screenshot");

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

      const att = await Attendance.findOne({
        empId: employeeId,
        date: { $gte: startOfDay, $lt: endOfDay }
      });

      if (att) {
        // Increment working hours by actual tracked elapsed time, capped at interval + buffer
        let addedSec = trackedSeconds !== undefined && !isNaN(Number(trackedSeconds)) 
          ? Number(trackedSeconds) 
          : intervalSec;
        
        // Cap added seconds to interval + 60s to prevent huge jumps from anomalies
        addedSec = Math.max(0, Math.min(addedSec, intervalSec + 60));

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

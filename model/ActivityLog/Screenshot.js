const mongoose = require("mongoose");

const ScreenshotSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SignUp", // Matches the SignUp model representing employees
      required: true,
      index: true
    },
    imageBuffer: {
      type: String, // Holds the compressed base64 JPEG data URL
      required: true
    },
    currentRoute: {
      type: String,
      required: false
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 1296000 // TTL index: auto-delete document after 15 days (1296000 seconds)
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Screenshot", ScreenshotSchema);

const mongoose = require("mongoose");
require("dotenv").config();

const { runDomainExpiryReminderJob } = require("../cronJobs/domainExpiryReminderCron");

async function test() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    console.log("\n--- Running Domain Expiry Reminder Job ---\n");
    await runDomainExpiryReminderJob();
    console.log("\n--- Completed Domain Expiry Reminder Job ---\n");

    process.exit(0);
  } catch (err) {
    console.error("Test error:", err);
    process.exit(1);
  }
}

test();

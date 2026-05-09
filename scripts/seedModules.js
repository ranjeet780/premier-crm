const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const Module = require("../model/Module/modules");

const modules = [
  { key: "jobOpenings", label: "Job Openings", actions: ["View", "Add", "Edit", "Delete"] },
  { key: "employees", label: "Employees", actions: ["View", "Add", "Edit", "Delete"] },
  { key: "tasks", label: "Tasks", actions: ["View", "Add", "Edit", "Delete"] },
  { key: "attendance", label: "Attendance", actions: ["View", "Add", "Edit"] },
  { key: "leads", label: "Leads", actions: ["View", "Add"] },
];

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL is missing in backend/.env");
  }

  await mongoose.connect(mongoUrl);

  // Upsert keeps existing DB data safe while ensuring required modules exist.
  const operations = modules.map((moduleData) => ({
    updateOne: {
      filter: { key: moduleData.key },
      update: { $set: moduleData },
      upsert: true,
    },
  }));

  await Module.bulkWrite(operations, { ordered: false });
  console.log(`Modules seeded/updated: ${modules.length}`);
}

run()
  .catch((err) => {
    console.error("Failed to seed modules:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (_) {}
  });

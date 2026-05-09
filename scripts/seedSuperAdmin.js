const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const User = require("../model/Users/Users");

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL is missing in backend/.env");
  }

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
  const name = process.env.BOOTSTRAP_ADMIN_NAME || "Super Admin";
  const role = process.env.BOOTSTRAP_ADMIN_ROLE || "superadmin";
  if (!email) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL is missing in backend/.env");
  }
  if (!password) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD is missing in backend/.env");
  }

  await mongoose.connect(mongoUrl);
  await User.updateOne(
    { email },
    {
      $set: {
        name,
        role,
        // Keep explicit hash here (compatible with updateOne path).
        password: bcrypt.hashSync(password, 10),
        permissions: {},
      },
    },
    { upsert: true }
  );
  console.log(`SuperAdmin ready: ${email}`);
}

run()
  .catch((err) => {
    console.error("Failed to seed super admin:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (_) {}
  });

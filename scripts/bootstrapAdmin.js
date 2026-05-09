const mongoose = require("mongoose");
const path = require("path");
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

  const existing = await User.findOne({ email });
  if (existing) {
    // Reset to known credentials (schema pre-save will hash password)
    existing.name = name;
    existing.role = role;
    existing.password = password;
    if (!existing.permissions || typeof existing.permissions !== "object") {
      existing.permissions = {};
    }
    await existing.save();
    console.log(`Admin already existed. Credentials reset successfully: ${email}`);
    await mongoose.disconnect();
    return;
  }

  await User.create({
    name,
    email,
    // keep plaintext here; schema pre-save middleware hashes it
    password,
    role,
    permissions: {},
  });

  console.log(`Admin created successfully: ${email}`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Failed to bootstrap admin:", err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

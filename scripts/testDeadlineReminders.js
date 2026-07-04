const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const Task = require("../model/Task/Task");
const Notification = require("../model/Notification/Notification");
const NotificationForAll = require("../model/Notification/NotificationForAll");
const SignUp = require("../model/SignUp/SignUp");
const User = require("../model/Users/Users");
const { runTaskDeadlineReminderJob } = require("../cronJobs/taskDeadlineReminderCron");

async function test() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL is missing in backend/.env");
  }

  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(mongoUrl);

  // 1. Get an existing employee (SignUp) and superadmin user
  const employee = await SignUp.findOne({ isActive: true });
  if (!employee) {
    console.log("❌ No active employee (SignUp) found in database. Please register one first.");
    return;
  }
  console.log(`👤 Found target employee: ${employee.ename || employee.name || employee.official_email} (${employee._id})`);

  let systemUser = await User.findOne({ role: "superadmin" });
  if (!systemUser) {
    systemUser = await User.findOne();
  }
  if (!systemUser) {
    console.log("❌ No Admin/User found in database. Running seedSuperAdmin first might help.");
    return;
  }
  console.log(`👤 Found system/admin user: ${systemUser.name} (${systemUser._id})`);

  // 2. Create one mock task due in 2.5 days (approx 60 hours, which is <= 3 days / 72 hours, triggers offset 3)
  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + 60);

  console.log("📝 Creating a mock task due in 60 hours (2.5 days)...");
  const mockTask = await Task.create({
    title: "TEST TASK: Deadline Warning Test",
    description: "This task was created by the test script to verify deadline reminders.",
    dueDate: dueDate,
    startDate: new Date(),
    assignedTo: [employee._id],
    status: "In Progress",
    clientId: mongoose.Types.ObjectId.isValid(employee._id) ? employee._id : new mongoose.Types.ObjectId(), // Dummy clientId
    projectId: mongoose.Types.ObjectId.isValid(employee._id) ? employee._id : new mongoose.Types.ObjectId(), // Dummy projectId
  });
  console.log(`✅ Created Mock Task: "${mockTask.title}" (ID: ${mockTask._id}) due on ${mockTask.dueDate.toLocaleString()}`);

  // Clear any pre-sent offsets, just in case
  mockTask.reminder_offsets_sent = [];
  await mockTask.save();

  console.log("\n🚀 Triggering runTaskDeadlineReminderJob directly...");
  await runTaskDeadlineReminderJob();

  // 3. Verify notifications are generated
  console.log("\n🔍 Verifying generated notifications in the Database...");

  // Check Employee notification
  const empNotifications = await Notification.find({
    "users.userId": employee._id,
    title: "Task Deadline Reminder",
  }).sort({ createdAt: -1 }).limit(1);

  if (empNotifications.length > 0) {
    console.log("⭐ [SUCCESS] Employee Notification created in DB:");
    console.log(`   - Title: "${empNotifications[0].title}"`);
    console.log(`   - Body: "${empNotifications[0].body}"`);
  } else {
    console.log("❌ [FAILURE] Employee Notification NOT found in DB!");
  }

  // Check Admin notification
  const adminNotifications = await NotificationForAll.find({
    type: "TASK_DEADLINE_REMINDER",
    refId: mockTask._id,
  }).sort({ createdAt: -1 }).limit(1);

  if (adminNotifications.length > 0) {
    console.log("⭐ [SUCCESS] Admin/Superadmin Notification created in DB:");
    console.log(`   - Title: "${adminNotifications[0].title}"`);
    console.log(`   - Message: "${adminNotifications[0].message}"`);
  } else {
    console.log("❌ [FAILURE] Admin/Superadmin Notification NOT found in DB!");
  }

  // Check that the task now has offset 3 marked as sent
  const updatedTask = await Task.findById(mockTask._id);
  console.log(`⚙️ Task reminder_offsets_sent array state: [${updatedTask.reminder_offsets_sent.join(", ")}] (Expected: [3])`);

  // Clean up mock task
  console.log("\n🧹 Cleaning up mock task...");
  await Task.findByIdAndDelete(mockTask._id);
  console.log("🗑️ Cleaned up.");

}

test()
  .catch((err) => console.error("Test failed error:", err))
  .finally(async () => {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB. Test ended.");
  });

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const Task = require("../model/Task/Task");
const Notification = require("../model/Notification/Notification");
const NotificationForAll = require("../model/Notification/NotificationForAll");
const SignUp = require("../model/SignUp/SignUp");
const User = require("../model/Users/Users");
const { runTaskDeadlineReminderJob } = require("../cronJobs/taskDeadlineReminderCron");

async function testOverdue() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL is missing in backend/.env");
  }

  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(mongoUrl);

  // 1. Get an existing employee (SignUp) and superadmin user
  const employee = (await SignUp.findOne({ isActive: true })) || (await SignUp.findOne());
  if (!employee) {
    console.log("❌ No active employee (SignUp) found in database. Please register one first.");
    return;
  }
  const empName = employee.ename || employee.official_email || employee.personal_email || "Test Employee";
  console.log(`👤 Found target employee: ${empName} (${employee._id})`);

  let systemUser = await User.findOne({ role: "superadmin" });
  if (!systemUser) {
    systemUser = await User.findOne();
  }
  if (!systemUser) {
    console.log("❌ No Admin/User found in database.");
    return;
  }
  console.log(`👤 Found system/admin user: ${systemUser.name} (${systemUser._id})`);

  // 2. Create one mock OVERDUE task (due date 2 hours ago)
  const pastDueDate = new Date();
  pastDueDate.setHours(pastDueDate.getHours() - 2);

  console.log("📝 Creating a mock OVERDUE task (due 2 hours ago)...");
  const mockTask = await Task.create({
    title: "TEST TASK: Overdue Alert Verification",
    description: "This task was created by test script to verify overdue notifications.",
    dueDate: pastDueDate,
    startDate: new Date(Date.now() - 86400000), // yesterday
    assignedTo: [employee._id],
    status: "Pending",
    overdueNotificationSent: false,
    clientId: mongoose.Types.ObjectId.isValid(employee._id) ? employee._id : new mongoose.Types.ObjectId(),
    projectId: mongoose.Types.ObjectId.isValid(employee._id) ? employee._id : new mongoose.Types.ObjectId(),
  });
  console.log(`✅ Created Overdue Task: "${mockTask.title}" (ID: ${mockTask._id}) due on ${mockTask.dueDate.toLocaleString()}`);

  console.log("\n🚀 Triggering runTaskDeadlineReminderJob directly...");
  await runTaskDeadlineReminderJob();

  // 3. Verify notifications generated in DB
  console.log("\n🔍 Verifying generated notifications in Database...");

  // Check Admin/Superadmin notification
  const adminNotifications = await NotificationForAll.find({
    type: "TASK_OVERDUE",
    refId: mockTask._id,
  }).sort({ createdAt: -1 }).limit(1);

  if (adminNotifications.length > 0) {
    console.log("⭐ [SUCCESS] Admin/Superadmin Overdue Notification created in DB:");
    console.log(`   - Title: "${adminNotifications[0].title}"`);
    console.log(`   - Message: "${adminNotifications[0].message}"`);
  } else {
    console.log("❌ [FAILURE] Admin/Superadmin Overdue Notification NOT found in DB!");
  }

  // Check Employee notification
  const empNotifications = await Notification.find({
    "users.userId": employee._id,
    title: "Task Overdue Notice",
  }).sort({ createdAt: -1 }).limit(1);

  if (empNotifications.length > 0) {
    console.log("⭐ [SUCCESS] Employee Overdue Notification created in DB:");
    console.log(`   - Title: "${empNotifications[0].title}"`);
    console.log(`   - Body: "${empNotifications[0].body}"`);
  } else {
    console.log("❌ [FAILURE] Employee Overdue Notification NOT found in DB!");
  }

  // Verify task flag
  const updatedTask = await Task.findById(mockTask._id);
  console.log(`⚙️ Task overdueNotificationSent state: ${updatedTask.overdueNotificationSent} (Expected: true)`);

  // Clean up mock task & notifications
  console.log("\n🧹 Cleaning up test task and notifications...");
  await Task.findByIdAndDelete(mockTask._id);
  if (adminNotifications.length > 0) {
    await NotificationForAll.findByIdAndDelete(adminNotifications[0]._id);
  }
  if (empNotifications.length > 0) {
    await Notification.findByIdAndDelete(empNotifications[0]._id);
  }
  console.log("🗑️ Cleaned up test data.");
}

testOverdue()
  .catch((err) => console.error("Test failed error:", err))
  .finally(async () => {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB. Test ended.");
  });

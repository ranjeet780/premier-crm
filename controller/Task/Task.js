// controller/Task/Task.js
const mongoose = require("mongoose");
const Task = require("../../model/Task/Task");
const SignUp = require("../../model/SignUp/SignUp");
const Project = require('../../model/Project/Projects')
const Notification = require('../../model/Notification/adminNotification')
const EmployeeNotification = require("../../model/Notification/Notification");
const path = require("path");
const fs = require("fs");




// ---------- Add Task (Admin) ----------
const addTask = async (req, res) => {
  try {
    const {
      clientId,
      projectId,
      serviceId,
      departmentId,
      assignedTo,
      title,
      category,
      startDate,
      dueDate,
      status,
      description,
      priority,
      estimatedTime
    } = req.body;

    if (!clientId || !projectId || !title || !startDate || !dueDate) {
      return res.status(400).json({ message: "Required fields missing!" });
    }

    // const newTask = new Task({
    //   clientId,
    //   projectId,
    //   serviceId,
    //   departmentId,
    //   assignedTo,
    //   title,
    //   category,
    //   startDate,
    //   dueDate,
    //   status: status || "Pending",
    //   description,
    //   priority: priority || "Low",
    //   estimatedTime: estimatedTime || 0,
    //   timeSpent: 0,
    //   timeLogs: [],
    //   comments: []
    // });

const newTask = new Task({
  clientId,
  projectId,
  serviceId,
  departmentId,
  assignedTo,
  title,
  category,
  startDate,
  dueDate,
  status: status || "Pending",
  description,
  priority: priority || "Low",
  estimatedTime: estimatedTime || 0,
  timeSpent: 0,
  timeLogs: [],
  comments: [],
  statusHistory: [],   // ✅ ADD THIS
});


    const saveTask = await newTask.save();

    if (Array.isArray(assignedTo) && assignedTo.length > 0) {
      const uniqueEmployeeIds = [...new Set(assignedTo.map((id) => String(id)))];
      await Promise.all(
        uniqueEmployeeIds.map((empId) =>
          EmployeeNotification.create({
            title: "New Task Assigned",
            body: `You have been assigned a new task: ${title}`,
            category: "Task",
            priority: priority || "Low",
            allUsers: false,
            users: [{ userId: empId }],
            userCount: 1,
            status: "sent",
          })
        )
      );
    }

    return res.status(200).json({ message: "Task Assigned Successfully ✅", task: saveTask });
  } catch (error) {
    console.error("addTask:", error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- Get All Tasks (Admin) ----------
const getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate("assignedTo", "ename name email")
      .populate("clientId", "leadName clientName")
      .populate("projectId", "projectName")
      .sort({ createdAt: -1 });

    res.status(200).json({ message: "Tasks fetched successfully", tasks });
  } catch (error) {
    console.error("getAllTasks:", error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- Get Tasks assigned to an employee (alias and original) ----------
const getTasks = async (req, res) => {
  try {
    const employeeId = req.params.empId || req.params.employeeId;
    if (!employeeId) return res.status(400).json({ message: "empId required" });

    const tasks = await Task.find({ assignedTo: employeeId })
      .populate("assignedTo", "ename name email")
      .populate("projectId", "projectName")
      .populate("clientId", "clientName")
      .sort({ createdAt: -1 });

    // format for employee frontend
    const formatted = tasks.map(t => ({
      _id: t._id,
      taskId: t.TaskId,
      title: t.title,
      project: t.projectId?.projectName,
      completedOn: t.completedOn,
      startDate: t.startDate,
      dueDate: t.dueDate,
      estimatedTime: t.estimatedTime,
      timeSpent: t.timeSpent,
       timeLogs: t.timeLogs, 
      assignedTo: t.assignedTo.map(u => ({ _id: u._id, name: u.ename || u.name || u.email })),
      status: t.status,
      priority: t.priority,
      incompleteReason: t.incompleteReason,
      commentsCount: t.comments?.length || 0
    }));

    return res.status(200).json({ success: true, tasks: formatted });
  } catch (err) {
    console.error("getTasks:", err);
    res.status(500).json({ message: err.message });
  }
};

// ---------- View task (Admin full) ----------
const viewTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId)
      .populate("assignedTo", "ename email")
      .populate("comments.user", "ename email")
      .populate("projectId", "projectName")
      .populate("clientId", "leadName")
      .populate("serviceId", "serviceName");

    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// ---------- View task for employee (same as viewTask but can be used) ----------
const viewTaskForEmployee = async (req, res) => {
  return viewTask(req, res);
};

// ---------- View task for client (limited fields, only comments with visibleToClient true) ----------
const viewTaskForClient = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId)
      .populate("projectId", "projectName")
      .populate("serviceId", "serviceName")
      .populate("clientId", "clientName");

    if (!task) return res.status(404).json({ message: "Task not found" });

    const resp = {
      _id: task._id,
      TaskId: task.TaskId,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      startDate: task.startDate,
      dueDate: task.dueDate,
      status: task.status,
      project: task.projectId?.projectName,
      service: task.serviceId?.serviceName,
      timeSpent: task.timeSpent,
      comments: (task.comments || []).filter(c => c.visibleToClient).map(c => ({
        text: c.text,
        attachment: c.attachment,
        createdAt: c.createdAt
      })),
    };

    return res.json({ success: true, task: resp });
  } catch (err) {
    console.error("viewTaskForClient:", err);
    res.status(500).json({ message: err.message });
  }
};

// ---------- Update Task (Admin) ----------


const updateTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    const body = req.body;

    if (body.dueDate) {
      body.reminder_offsets_sent = [];
    }

    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      body,
      { new: true }
    )
      .populate("assignedTo", "ename") 
      .populate("clientId", "leadName")
      .populate("projectId", "projectName")
      .populate("serviceId", "serviceName");

    if (!updatedTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(200).json({
      success: true,
      task: updatedTask,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};



// ---------- Delete Task (Admin) ----------
const deleteTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    const deletedTask = await Task.findByIdAndDelete(taskId);
    if (!deletedTask) return res.status(404).json({ message: "Task not found" });
    res.status(200).json({ success: true, message: "Task deleted" });
  } catch (err) {
    console.error("deleteTask:", err);
    res.status(500).json({ message: err.message });
  }
};

// ---------- Start Timer (Employee) ----------


// ---------- Start Timer ----------
const startTimer = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // 🔒 Check if another task of same employee is running
    const runningTask = await Task.findOne({
      assignedTo: task.assignedTo,
      timeLogs: { $elemMatch: { endAt: null } },
      _id: { $ne: taskId }
    });

    if (runningTask) {
      return res.status(400).json({
        message: "Another task is already running"
      });
    }

    // 🔒 Check if this task is already running
    const lastLog = task.timeLogs[task.timeLogs.length - 1];
    if (lastLog && !lastLog.endAt) {
      return res.status(400).json({ message: "Timer already running" });
    }

    // ▶ Start timer
    task.timeLogs.push({
      startAt: new Date(),
      endAt: null,
      duration: 0
    });

    task.isRunning = true;

    await task.save();

    res.json({
      success: true,
      message: "Timer started",
      startAt: task.timeLogs[task.timeLogs.length - 1].startAt
    });
  } catch (err) {
    console.error("startTimer error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



// ---------- Stop Timer (Employee) ----------

// ---------- Stop Timer ----------
const stopTimer = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const lastLog = task.timeLogs[task.timeLogs.length - 1];

    if (!lastLog || lastLog.endAt) {
      return res.status(400).json({ message: "Timer not running" });
    }

    lastLog.endAt = new Date();
    lastLog.duration = Math.floor(
      (lastLog.endAt - lastLog.startAt) / 1000
    );

    task.timeSpent = task.timeLogs.reduce(
      (sum, log) => sum + (log.duration || 0),
      0
    );

    task.isRunning = false;

    await task.save();

    res.json({
      success: true,
      message: "Timer stopped",
      timeSpent: task.timeSpent
    });
  } catch (err) {
    console.error("stopTimer error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------- Update Task Status (employee/admin) ----------
// const updateTaskStatus = async (req, res) => {
//   try {
//     const { taskId } = req.params;
//     const { status, reason, progress } = req.body;

//     const task = await Task.findById(taskId);
//     if (!task) {
//       return res.status(404).json({ message: "Task not found" });
//     }

//     task.status = status;

//     task.statusHistory.push({
//       status,
//       reason,
//       progress: status === "In Progress" ? Number(progress) : undefined,
//       attachment: req.file ? req.file.path : null,
//       updatedAt: new Date(),
//     });

//     if (status === "Completed") {
//       task.completedOn = new Date();
//     }

//     await task.save();

//     res.json({ success: true });
//   } catch (err) {
//     console.error("STATUS UPDATE ERROR:", err);
//     res.status(500).json({
//       message: "Status update failed",
//       error: err.message,
//     });
//   }
// };

const updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, reason, progress } = req.body;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid taskId" });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (!task.statusHistory) task.statusHistory = [];

    task.status = status;

    task.statusHistory.push({
      status,
      reason,
      progress: status === "In Progress" ? Number(progress) : undefined,
      attachment: req.file ? req.file.path : null,
      updatedAt: new Date(),
    });

    if (status === "Completed") {
      task.completedOn = new Date();
    }

    await task.save();

    res.json({ success: true });
  } catch (err) {
    console.error("STATUS UPDATE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};


// ---------- Add Comment (with optional attachment) ----------
const addComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId, text } = req.body;

    const task = await Task.findById(taskId).populate("assignedTo");
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // ✅ SAME COMMENT OBJECT (UNCHANGED)
    const comment = {
      user: userId,
      text,
      createdAt: new Date()
    };

    if (req.file) {
      comment.attachment = `uploads/comments/${req.file.filename}`;
    }

    task.comments.push(comment);
    await task.save();

    // 🔔 RESTORED: CREATE NOTIFICATION (THIS WAS MISSING)
    if (task.assignedTo?.length) {
      for (const emp of task.assignedTo) {
        await Notification.create({
          user: emp._id,
          task: task._id,
          title: "New Admin Comment",
          message: text,
          isRead: false
        });
      }
    }

    res.json({ success: true, comment });

  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ message: err.message });
  }
};


// ---------- Serve attachment (helper) ----------
const serveAttachment = (req, res) => {
  // attachments are stored under /controller/uploads (your project already exposes /uploads)
  const file = req.params.filename;
  const filePath = path.join(process.cwd(), "controller", "uploads", file);
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
  res.sendFile(filePath);
};


const getEmployeesByServiceInTask = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const employees = await SignUp.find({
      service: new mongoose.Types.ObjectId(serviceId),
      role: "employee",
      isActive: true
    }).select("_id ename");

    res.status(200).json({ employees });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const autoStopTimer = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const runningTask = await Task.findOne({
      assignedTo: employeeId,
      timeLogs: { $elemMatch: { endAt: null } },
    });

    if (!runningTask) {
      return res.json({ success: true, message: "No running task" });
    }

    const lastLog =
      runningTask.timeLogs[runningTask.timeLogs.length - 1];

    lastLog.endAt = new Date();
    lastLog.duration = Math.floor(
      (lastLog.endAt - lastLog.startAt) / 1000
    );

    runningTask.timeSpent = runningTask.timeLogs.reduce(
      (acc, l) => acc + l.duration,
      0
    );

    await runningTask.save();

    res.json({ success: true, message: "Timer auto-stopped" });
  } catch (err) {
    console.error("autoStopTimer error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const getTaskStatusHistoryForAdmin = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid taskId" });
    }

    const task = await Task.findById(taskId)
      .select("status statusHistory updatedAt");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json({
      status: task.status,
      statusHistory: task.statusHistory || [],
      updatedAt: task.updatedAt,
    });
  } catch (err) {
    console.error("STATUS HISTORY ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};
const getStatusAttachmentForAdmin = async (req, res) => {
  try {
    const { taskId, index } = req.params;

    const task = await Task.findById(taskId);

    if (!task || !task.statusHistory?.length) {
      return res.status(404).send("No status history");
    }

    const status = task.statusHistory[index];

    if (!status || !status.attachment) {
      return res.status(404).send("Attachment not found");
    }

    const filePath = path.join(process.cwd(), status.attachment);

    return res.sendFile(filePath);
  } catch (err) {
    console.error("ADMIN ATTACHMENT ERROR:", err);
    res.status(500).send("Unable to load file");
  }
};



module.exports = {
  addTask,
  getAllTasks,
  getTasks,
  viewTask,
  viewTaskForEmployee,
  viewTaskForClient,
  updateTask,
  deleteTask,
  startTimer,
  stopTimer,
  updateTaskStatus,
  addComment,
  serveAttachment,
  getEmployeesByServiceInTask,
  autoStopTimer,
  getTaskStatusHistoryForAdmin,
  getStatusAttachmentForAdmin
};

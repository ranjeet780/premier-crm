const SignUp = require("../../model/SignUp/SignUp");
const Project = require("../../model/Project/Projects");
const Task = require("../../model/Task/Task");
const Client = require("../../model/ClientLead/ClientLead");

const getEmployeeProjectList = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate("assignedTo", "ename employeeId")
      .populate("clientId", "leadName")
      .populate("projectId", "projectName");

    const formatted = tasks.map(t => {

      // pick the first assigned employee (you can customize this)
      const emp = t.assignedTo?.[0];

      return {
        employeeId: emp?._id,
        employeeName: emp?.ename,

        projectName: t.projectId?.projectName,
        clientName: t.clientId?.leadName,

        status: t.status,
        startDate: t.startDate,
        endDate: t.dueDate,

        taskId: t._id
      };
    });

    res.json(formatted);

  } catch (err) {
    console.log("❌ Employee Project List Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};
const getEmployeeTasks = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await SignUp.findById(
      employeeId,
      "ename employeeId"
    );

    const tasks = await Task.find({ assignedTo: employeeId })
      .populate("projectId", "projectName")
      .populate("clientId", "leadName");

    const formattedTasks = tasks.map(t => ({
      _id: t._id,                 // ✅ REQUIRED
      title: t.title,
      projectId: t.projectId,
      clientId: t.clientId,
      status: t.status,
      priority: t.priority,
      timeLogs: t.timeLogs,
      timeSpent: t.timeSpent,
      updatedAt: t.updatedAt,
    }));
    res.json({
      employee,
      tasks: formattedTasks
    });

  } catch (err) {
    console.log("❌ Employee Tasks Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};



const getTaskDetails = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId)
      .populate("assignedTo", "ename employeeId")
      .populate("projectId", "projectName")
      .populate("clientId", "leadName clientName")
      .populate("comments.user", "ename");

    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    res.json({
      taskId: task._id,
      taskTitle: task.title,
      description: task.description,

      projectName: task.projectId?.projectName,
      clientName: task.clientId?.leadName || task.clientId?.clientName || "-",

      assignedTo: task.assignedTo?.map(u => ({
        name: u.ename,
        id: u._id
      })),

      priority: task.priority,
      status: task.status,
      startDate: task.startDate,
      deadline: task.dueDate,

      timeSpent: task.timeSpent,
      estimatedTime: task.estimatedTime,

      incompleteReason: task.incompleteReason,

      comments: task.comments,
      timeLogs: task.timeLogs
    });

  } catch (err) {
    console.log("❌ Task Details Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

const getEmployeeTask = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const month = req.query.month; // 1–12 or "all"
    const year = req.query.year;   // 2023, 2024, 2025...

    let filter = { assignedTo: employeeId };

    if (month !== "all" && year !== "all") {
      const start = new Date(`${year}-${month}-01`);
      const end = new Date(year, Number(month), 0);

      filter.startDate = { $gte: start, $lte: end };
    }

    const tasks = await Task.find(filter)
      .sort({ startDate: -1 })
      .lean();

    res.json(tasks);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching employee tasks" });
  }
};


module.exports = { getEmployeeProjectList, getEmployeeTasks, getTaskDetails, getEmployeeTask } 

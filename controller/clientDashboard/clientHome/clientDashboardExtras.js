// controller/Client/clientDashboardExtras.js
const Project = require("../../../model/Project/Projects");
const Proposal = require("../../../model/Purposal/Purposal") || require("../../../model/Purposal/Purposal");
const Task = require("../../../model/Task/Task");
const Client = require("../../../model/ClientLead/ClientLead") || require("../../../model/ClientLead/ClientLead"); // adjust path/name

// --- Projects list for client
const getClientProjects = async (req, res) => {
  try {
    const { clientId } = req.params;

    const projects = await Project.find({ clientId })
      .populate("department", "departmentName")
      .populate("service", "serviceName")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, projects });
  } catch (error) {
    console.error("getClientProjects:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// --- Single project details
const getClientProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate("department", "departmentName")
      .populate("service", "serviceName")
      .populate("addMember", "ename email");

    if (!project)
      return res.status(404).json({ success: false, message: "Project not found" });

    res.status(200).json({ success: true, project });
  } catch (error) {
    console.error("getClientProject:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Client proposals list
const getClientProposals = async (req, res) => {
  try {
    const { clientId } = req.params;
    const proposals = await Proposal.find({ clientId }).sort({ createdAt: -1 });
    return res.json({ success: true, proposals });
  } catch (err) {
    console.error("getClientProposals:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- Single proposal view
const getClientProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const proposal = await Proposal.findById(proposalId).lean();
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });
    return res.json({ success: true, proposal });
  } catch (err) {
    console.error("getClientProposal:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- Client profile get
const getClientProfile = async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await Client.findById(clientId).select("-password");
    if (!client) return res.status(404).json({ message: "Client not found" });
    return res.json({ success: true, client });
  } catch (err) {
    console.error("getClientProfile:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- Client profile update
const updateClientProfile = async (req, res) => {
  try {
    const { clientId } = req.params;
    const update = req.body; // validate fields in real app
    const updated = await Client.findByIdAndUpdate(clientId, update, { new: true }).select("-password");
    if (!updated) return res.status(404).json({ message: "Client not found" });
    return res.json({ success: true, client: updated });
  } catch (err) {
    console.error("updateClientProfile:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- Client tasks list (tasks related to client's projects)
const getClientTasks = async (req, res) => {
  try {
    const { clientId } = req.params;
    // find tasks where clientId matches
    const tasks = await Task.find({ clientId })
      .populate("assignedTo", "ename")
      .populate("projectId", "projectName")
      .sort({ createdAt: -1 });

    return res.json({ success: true, tasks });
  } catch (err) {
    console.error("getClientTasks:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- Single task view for client (limited details + comments visibleToClient true)
const getClientTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const t = await Task.findById(taskId)
      .populate("projectId", "projectName")
      .populate("assignedTo", "ename")
      .lean();

    if (!t) return res.status(404).json({ message: "Task not found" });

    // limit comments visible to client
    const comments = (t.comments || []).filter((c) => c.visibleToClient).map((c) => ({
      text: c.text,
      attachment: c.attachment,
      createdAt: c.createdAt,
    }));

    const resp = {
      _id: t._id,
      TaskId: t.TaskId,
      title: t.title,
      description: t.description,
      status: t.status,
      project: t.projectId?.projectName,
      startDate: t.startDate,
      dueDate: t.dueDate,
      timeSpent: t.timeSpent,
      comments,
    };

    return res.json({ success: true, task: resp });
  } catch (err) {
    console.error("getClientTask:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getClientProjects,
  getClientProject,
  getClientProposals,
  getClientProposal,
  getClientProfile,
  updateClientProfile,
  getClientTasks,
  getClientTask,
};

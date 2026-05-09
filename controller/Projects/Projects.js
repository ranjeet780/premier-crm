
const Project = require('../../model/Project/Projects');
const SignUp = require('../../model/SignUp/SignUp'); 
const mongoose = require("mongoose");
const ClientLead = require('../../model/ClientLead/ClientLead')

// CREATE PROJECT
const createProject = async (req, res) => {
  try {
    console.log("req.file:", req.file); // uploaded file info
    console.log("req.body:", req.body); // form data

    let {
      projectName,
      department,
      service,
      price,
      startDate,
      endDate,
      projectCategory,
      addMember,
      notes,
      projectDescription,
      clientId,
      leadId,
      displayClientId
    } = req.body;

    if (!projectName || !String(projectName).trim()) {
      return res.status(400).json({ error: "Project name is required." });
    }

    const rawClientRef = clientId || leadId || displayClientId;
    let resolvedClientId = rawClientRef;

    if (!resolvedClientId) {
      return res.status(400).json({ error: "Client is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(resolvedClientId)) {
      const clientByLeadId = await ClientLead.findOne({ leadId: resolvedClientId }).select("_id");
      if (!clientByLeadId) {
        return res.status(400).json({ error: "Valid client is required." });
      }
      resolvedClientId = clientByLeadId._id.toString();
    }

    // Handle multipart arrays from keys like projectCategory[].
    if (!projectCategory && req.body["projectCategory[]"]) {
      projectCategory = req.body["projectCategory[]"];
    }

    if (typeof projectCategory === "string") {
      projectCategory = [projectCategory];
    }

    if (!addMember && req.body["addMember[]"]) {
      addMember = req.body["addMember[]"];
    }

    if (typeof addMember === "string") {
      try {
        const parsed = JSON.parse(addMember);
        addMember = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        addMember = [addMember];
      }
    }

    if (!Array.isArray(addMember)) {
      addMember = [];
    }

    // ✅ 1. Create new project
    const newProject = new Project({
      projectName,
      department,
      service,
      price,
      startDate,
      endDate,
      projectCategory,
      addMember,
      notes,
      // addMember: addMember ? JSON.parse(addMember) : [],
      projectDescription,
      clientId: resolvedClientId,
      addFile: req.file ? req.file.filename : null
    });

    // ✅ 2. Save project in DB
    await newProject.save();

    // ✅ 3. Link this project to the client
    if (resolvedClientId) {
      await ClientLead.findByIdAndUpdate(
        resolvedClientId,
        { $push: { projects: newProject._id } },
        { new: true }
      );
      console.log("Project linked to client:", resolvedClientId);
    }

    // ✅ 4. Send response
    res.status(200).json({
      message: "Project Added & Linked Successfully",
      project: newProject
    });
  } catch (error) {
    console.error("Error in createProject:", error.message);
    res.status(500).json({ error: error.message });
  }
};


// GET ALL PROJECTS
const getProject = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate("clientId", "leadName")
      .populate("department", "deptName")
      .populate("service", "serviceName")
      .sort({ createdAt: -1 });
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProjectsByClient = async (req, res) => {
  try {
    const clientId = req.params.clientId;
    console.log("🔹 Client ID from params:", clientId);

    // SIMPLE & CORRECT QUERY
    const clientProjects = await Project.find({ clientId })
      .populate("department", "deptName")
      .populate("service", "serviceName")
      // remove addMember populate if not defined
      // .populate("addMember", "ename")
      .sort({ createdAt: -1 });

    console.log("✅ Found Projects:", clientProjects.length);

    res.status(200).json(clientProjects);
  } catch (error) {
    console.error("❌ Error fetching projects:", error);
    res.status(500).json({ error: error.message });
  }
};


const getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate("clientId", "leadName")
      .populate("department", "deptName")
      .populate("service", "serviceName");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProjectByProjectId = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Support both Mongo _id and business projectId (e.g. PRO2026-00001).
    const query = mongoose.Types.ObjectId.isValid(projectId)
      ? { _id: projectId }
      : { projectId };

    const project = await Project.findOne(query)
      .populate("clientId", "leadName email phone")   // only return selected client fields
      .populate("department", "deptName")
      .populate("service", "serviceName")
      .populate("addMember", "ename email");          // return assigned member names

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: error.message });
  }
};

const updateProject = async (req, res) => {
  try {
    const { id } = req.params;

    let {
      projectName,
      department,
      service,
      price,
      startDate,
      endDate,
      status,
      projectCategory,
      notes,
      projectDescription,
      addMember,
    } = req.body;

    // Normalize category input from comma-text / single value / array.
    if (typeof projectCategory === "string") {
      projectCategory = projectCategory
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (!Array.isArray(projectCategory)) {
      projectCategory = [];
    } else {
      projectCategory = projectCategory.map((item) => String(item).trim()).filter(Boolean);
    }

    // Normalize addMember from react-select IDs / JSON string / array.
    if (typeof addMember === "string") {
      try {
        const parsed = JSON.parse(addMember);
        addMember = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        addMember = addMember ? [addMember] : [];
      }
    }
    if (!Array.isArray(addMember)) addMember = [];

    const normalizedMemberIds = addMember
      .map((member) => {
        if (!member) return null;
        if (typeof member === "object") return member.value || member._id || null;
        return member;
      })
      .filter((memberId) => memberId && mongoose.Types.ObjectId.isValid(memberId))
      .map((memberId) => new mongoose.Types.ObjectId(memberId));

    // If addMember was sent but none are valid ObjectIds, fail explicitly.
    if (addMember.length > 0 && normalizedMemberIds.length === 0) {
      return res.status(400).json({ message: "Invalid employee selection in assigned members." });
    }

    const updateData = {
      projectName: projectName ? String(projectName).trim() : projectName,
      department:
        department && mongoose.Types.ObjectId.isValid(department)
          ? new mongoose.Types.ObjectId(department)
          : null,
      service:
        service && mongoose.Types.ObjectId.isValid(service)
          ? new mongoose.Types.ObjectId(service)
          : null,
      price: price === "" || price == null ? null : Number(price),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status,
      projectCategory,
      notes: notes ?? "",
      projectDescription: projectDescription ?? "",
      addMember: normalizedMemberIds,
    };

    if (Number.isNaN(updateData.price)) {
      return res.status(400).json({ message: "Price must be a valid number." });
    }
    if (updateData.startDate && Number.isNaN(updateData.startDate.getTime())) {
      return res.status(400).json({ message: "Start date is invalid." });
    }
    if (updateData.endDate && Number.isNaN(updateData.endDate.getTime())) {
      return res.status(400).json({ message: "End date is invalid." });
    }

    const updatedProject = await Project.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("clientId", "leadName")
      .populate("department", "deptName")
      .populate("service", "serviceName")
      .populate("addMember", "ename email");

    if (!updatedProject) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({
      message: "Project updated successfully",
      project: updatedProject,
    });
  } catch (error) {
    console.error("Update Project Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Project.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({ message: "Project deleted successfully" });
  } catch (err) {
    console.error("Delete project error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }


};


const getEmployeesByProjectId = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Find project by _id
    const project = await Project.findById(projectId)
      .populate("addMember", "ename official_email personal_email phoneNo userType department service");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (!project.addMember || project.addMember.length === 0) {
      return res.status(200).json({
        message: "No employees assigned to this project",
        employees: []
      });
    }

    res.status(200).json({
      message: "Employees fetched successfully",
      projectName: project.projectName,
      employees: project.addMember
    });
  } catch (error) {
    console.error("Error fetching employees by project:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const getProjectDetailById = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Find project by _id
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({
      message: "Project details fetched successfully",
      projectCategory: project.projectCategory,
      startDate: project.startDate,
      endDate: project.endDate,
      projectName: project.projectName
    });
  } catch (error) {
    console.error("Error fetching project details:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
};





module.exports = {
  createProject,
  updateProject ,
  getProjectByProjectId,
  getProject,
  getProjectById,
  getProjectsByClient,
  deleteProject,
  getEmployeesByProjectId,
  getProjectDetailById
};

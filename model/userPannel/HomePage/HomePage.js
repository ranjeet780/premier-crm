const Project = require('../../../model/Project/Projects');
const Leave = require('../../../model/userPannel/Leaves/Leaves');

// Employee Dashboard Stats (NO due date logic)
const getEmployeeStats = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;

    if (!employeeId) {
      return res.status(400).json({ error: "Employee ID is required" });
    }

    // 1. Fetch all projects where employee is assigned
    const projects = await Project.find({ addMember: employeeId });

    const totalProjects = projects.length;

    // Pending projects (status NOT completed)
    const pendingProjects = projects.filter(p => p.status !== "Completed").length;

    // Completed projects
    const completedProjects = projects.filter(p => p.status === "Completed").length;

    // 2. Leaves section
    const leaves = await Leave.find({ employeeId });

    const totalLeaves = leaves.length;
    const pendingLeaves = leaves.filter(l => l.status === "Pending").length;
    const approvedLeaves = leaves.filter(l => l.status === "Approved").length;
    const rejectedLeaves = leaves.filter(l => l.status === "Rejected").length;

    // Response
    res.json({
      projects: {
        total: totalProjects,
        pending: pendingProjects,
        completed: completedProjects
      },
      leaves: {
        total: totalLeaves,
        pending: pendingLeaves,
        approved: approvedLeaves,
        rejected: rejectedLeaves
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getEmployeeStats };

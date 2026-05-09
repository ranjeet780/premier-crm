const Project = require("../../../model/Project/Projects");
const Proposal = require("../../../model/Purposal/Purposal");

const getClientDashboardSummary = async (req, res) => {
  try {
    const { clientId } = req.params;

    // Total Projects
    const totalProjects = await Project.countDocuments({ clientId });

    // Pending Projects
    const pendingProjects = await Project.countDocuments({
      clientId,
      status: { $ne: "Completed" },
    });

    // Total Proposals
    const totalProposals = await Proposal.countDocuments({ clientId });

    return res.json({
      success: true,
      totalProjects,
      pendingProjects,
      totalProposals,
    });
  } catch (err) {
    console.error("Client Dashboard Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = { getClientDashboardSummary };

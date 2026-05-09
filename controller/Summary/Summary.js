const Employee = require("../../model/SignUp/SignUp");
const Project = require("../../model/Project/Projects");
const Client = require("../../model/ClientLead/ClientLead");
const Invoice = require("../../model/Invoice/Invoice");
const JobOpening = require("../../model/JobOpening/JobOpening");
const Task = require("../../model/Task/Task");

const getAdminSummary = async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments();
    const totalProjects = await Project.countDocuments();
    const totalClients = await Client.countDocuments();

    const partialInvoices = await Invoice.find({
      status: { $in: ["Partial", "Pending"] },
    });

    const pendingPayments = partialInvoices.reduce((sum, invoice) => {
      const pending =
        typeof invoice.remainingAmount === "number"
          ? invoice.remainingAmount
          : (invoice.totalAmount || 0) - (invoice.paidAmount || 0);
      return sum + (pending > 0 ? pending : 0);
    }, 0);

    const jobsOpening = await JobOpening.countDocuments();

    // ✅ Task summary counts
    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ status: "Completed" });
    const pendingTasks = await Task.countDocuments({ status: "Pending" });
    const inProgressTasks = await Task.countDocuments({ status: "In Progress" });

    return res.json({
      totalEmployees,
      totalProjects,
      totalClients,
      pendingPayments,
      jobsOpening,
      totalTasks,
      completedTasks,
      pendingTasks,
      inProgressTasks,
    });
  } catch (error) {
    console.error("Error fetching admin summary:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { getAdminSummary };

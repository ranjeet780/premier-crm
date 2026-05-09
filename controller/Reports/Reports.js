const Proposal = require("../../model/Purposal/Purposal");
const Invoice = require("../../model/Invoice/Invoice");

const getReportsSummary = async (req, res) => {
  try {
    // Aggregate proposals count grouped by status
    const proposalsAggregation = await Proposal.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Aggregate invoices count grouped by status
    const invoicesAggregation = await Invoice.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

  
    const partialInvoices = await Invoice.find({ status: { $in: ["Partial", "Pending"] } });

    const totalPendingPartialPayment = partialInvoices.reduce((sum, invoice) => {
      // Use remainingAmount if present, else totalAmount - paidAmount
      const pending = typeof invoice.remainingAmount === "number"
        ? invoice.remainingAmount
        : ((invoice.totalAmount || 0) - (invoice.paidAmount || 0));
      return sum + (pending > 0 ? pending : 0);
    }, 0);

    // Convert aggregated arrays to objects with status as keys
    const proposalsSummary = proposalsAggregation.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    const invoicesSummary = invoicesAggregation.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    return res.json({
      proposals: {
        total: Object.values(proposalsSummary).reduce((a, b) => a + b, 0),
        approved: proposalsSummary["Accepted"] || 0,
        pending: proposalsSummary["Sent"] || 0,
        rejected: proposalsSummary["Rejected"] || 0,
        draft: proposalsSummary["Draft"] || 0,
      },
      invoices: {
        total: Object.values(invoicesSummary).reduce((a, b) => a + b, 0),
        paid: invoicesSummary["Paid"] || 0,
        partial: invoicesSummary["Partial"] || 0,
        pending: invoicesSummary["Pending"] || 0,
        partialPendingAmount: totalPendingPartialPayment,
      },
    });
  } catch (error) {
    console.error("Error fetching report summary:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { getReportsSummary };

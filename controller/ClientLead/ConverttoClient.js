const Lead = require('../../model/ClientLead/ClientLead')

const ConvertToClient = async (req, res) => {
    try {
        const { leadId } = req.params;
        const updateType = await Lead.findOneAndUpdate(
            { leadId },
            { userType: "client" },
            { new: true }
        );
        
        if (!updateType) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "Move to Client Successfully", user: updateType });

    } catch (error) {
        res.status(500).json({ error: error.message });  
    }
};
const updateStatus = async (req, res) => {
  try {
    const { status, customStatus } = req.body;
    const { id } = req.params;

    let updatedLead = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      updatedLead = await Lead.findByIdAndUpdate(
        id,
        { status, customStatus: status === "Other" ? customStatus : "" },
        { new: true }
      );
    }

    if (!updatedLead) {
      updatedLead = await Lead.findOneAndUpdate(
        { leadId: id },
        { status, customStatus: status === "Other" ? customStatus : "" },
        { new: true }
      );
    }

    if (!updatedLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    res.json({ message: "Status updated successfully", lead: updatedLead });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { ConvertToClient , updateStatus};

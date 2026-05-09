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
const updateStatus = async(req, res)=>{
    try {
    const { status, customStatus } = req.body;

    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status, customStatus: status === "Other" ? customStatus : "" },
      { new: true }
    );

    res.json(updatedLead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { ConvertToClient , updateStatus};

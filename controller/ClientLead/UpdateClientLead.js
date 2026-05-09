const ClientLead = require('../../model/ClientLead/ClientLead')
const createRoleBasedNotification = require("../../utils/createRoleBasedNotification");

// const updateClientUser = async (req, res) => {
//     try {
        
//         const UpdateUser = await ClientLead.findOneAndUpdate(
//             { leadId: req.params.leadId.trim() },
//             req.body,
//             { new: true }
//         );
//         if (!UpdateUser) {
//             return res.status(404).json({ message: "User not Found" })
//         }

//         res.json({ message: "User Update Sucessfully" }, UpdateUser)
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// }

const updateClientUser = async (req, res) => {
  try {
    // 🔐 Ensure auth
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { leadId } = req.params;

    const updatedUser = await ClientLead.findOneAndUpdate(
      { leadId: leadId.trim() },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    /* 🔔 ROLE-BASED NOTIFICATION */
    await createRoleBasedNotification({
      type: "CLIENT_LEAD_UPDATED",
      title: "Client Lead Updated",
      message: `${updatedUser.leadName} client lead was updated by ${req.user.role}`,
      module: "client-lead",
      refId: updatedUser._id,
      actorUserId: req.user.id,               // JWT id
      actorRole: req.user.role.toLowerCase(), // normalized
    });

    res.json({
      message: "User updated successfully",
      user: updatedUser,
    });

  } catch (error) {
    console.error("Update Client Lead Error:", error);
    res.status(500).json({ error: error.message });
  }
};


const deleteClientUser = async (req, res) => {
    try {
        const deletedUser = await ClientLead.findOneAndDelete({
            leadId: req.params.leadId,
        }).sort({ createdAt: -1 });

        if (!deletedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

module.exports = { updateClientUser, deleteClientUser }

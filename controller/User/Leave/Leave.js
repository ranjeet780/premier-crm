const Leaves = require('../../../model/userPannel/Leaves/Leaves')
const getLeaves = async (req, res) => {
  try {
    const leaves = await Leaves.find().sort({ createdAt: -1 }); 
    res.status(200).json(leaves);
  } catch (error) {
    console.error("Error fetching leaves:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
module.exports = {  getLeaves};
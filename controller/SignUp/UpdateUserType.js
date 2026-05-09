
const SignUp = require('../../model/SignUp/SignUp')
const mongoose = require("mongoose");
const {
  allocateBlockedPlaceholderId,
  allocateNextEmployeeId,
  releaseEmployeeId,
} = require("../../utils/employeeIdAllocator");

const UpdateType = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { userType } = req.body;

        const updateType = await SignUp.findOneAndUpdate(
            { employeeId },
            { userType },
            { new: true }  // returns updated document
        );

        if (!updateType) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "Move to Employee Successfully", user: updateType });

    } catch (error) {
        console.error("UpdateType error:", error);
        res.status(500).json({ error: error.message });
    }
};

const getAllEmployees = async (req, res) => {
  try {
    const employees = await SignUp.find()
      .populate("department", "deptName")
      .populate("service", "serviceName")
      .sort({ createdAt: -1 });

    return res.status(200).json(employees);
  } catch (err) {
    console.error("Error in getAllEmployees:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ========================
// DELETE EMPLOYEE BY _id OR employeeId
// ========================
const deleteEmployee = async (req, res) => {
  try {
    const id = req.params.id;

    // Try as MongoDB ObjectId
    let user = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      user = await SignUp.findById(id);
    }

    // If not found, try employeeId
    if (!user) {
      user = await SignUp.findOne({ employeeId: id });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await releaseEmployeeId({
      employeeId: user.employeeId,
      userId: user._id,
      reason: "deleted",
    });

    await user.deleteOne();

    return res.status(200).json({ message: "Employee deleted successfully" });
  } catch (err) {
    console.error("Delete employee error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

const toggleEmployeeBlock = async (req, res) => {
  try {
    const id = req.params.id;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be boolean" });
    }

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { employeeId: id }] }
      : { employeeId: id };
    const user = await SignUp.findOne(query);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentEmployeeId = String(user.employeeId || "");
    const updateData = { isActive };

    if (!isActive) {
      if (currentEmployeeId && !currentEmployeeId.startsWith("BLK-")) {
        await releaseEmployeeId({
          employeeId: currentEmployeeId,
          userId: user._id,
          reason: "blocked",
        });
      }
      updateData.employeeId = await allocateBlockedPlaceholderId();
    } else if (currentEmployeeId.startsWith("BLK-")) {
      updateData.employeeId = await allocateNextEmployeeId();
    }

    const updatedUser = await SignUp.findByIdAndUpdate(
      user._id,
      { $set: updateData },
      { new: true, runValidators: false }
    );

    return res.status(200).json({
      message: isActive ? "Employee unblocked successfully" : "Employee blocked successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Toggle employee block error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = { UpdateType, deleteEmployee, getAllEmployees, toggleEmployeeBlock };

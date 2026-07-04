const SignUp = require('../../model/SignUp/SignUp');
const createRoleBasedNotification = require(
  "../../utils/createRoleBasedNotification"
);
const { releaseEmployeeId } = require("../../utils/employeeIdAllocator");
const fileToBase64 = require("../../utils/fileToBase64");


// const updateUser = async (req, res) => {
//   try {
//     const { employeeId } = req.params;

//     // Start with request body data
//     const updateData = { ...req.body };

//     // ❌ Prevent overwriting file fields with wrong values from req.body
//     delete updateData.resumeFile;
//     delete updateData.img;

//     // ✅ Only update if new file uploaded
//     if (req.files?.resumeFile) {
//       updateData.resumeFile = `${req.protocol}://${req.get("host")}/uploads/resumes/${req.files.resumeFile[0].filename}`;
//     }

//     if (req.files?.img) {
//       updateData.img = `${req.protocol}://${req.get("host")}/uploads/images/${req.files.img[0].filename}`;
//     }

//     const updatedUser = await SignUp.findOneAndUpdate(
//       { employeeId },
//       updateData,
//       { new: true }
//     );

//     if (!updatedUser) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.json({
//       message: "User updated successfully",
//       user: updatedUser,
//     });
//   } catch (error) {
//     console.error("updateUser error:", error);
//     res.status(500).json({ error: error.message });
//   }
// };


const updateUser = async (req, res) => {
  try {
    // 🔐 Ensure auth
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { employeeId } = req.params;

    // Start with request body data
    const updateData = { ...req.body };

    // ❌ Prevent overwriting file fields with wrong values
    delete updateData.resumeFile;
    delete updateData.img;
    delete updateData.aadhaarFile;
    delete updateData.panFile;

    // ✅ Update resume if new file uploaded
    if (req.files?.resumeFile) {
      updateData.resumeFile = fileToBase64(req.files.resumeFile[0]);
    }

    // ✅ Update image if new file uploaded
    if (req.files?.img) {
      updateData.img = fileToBase64(req.files.img[0]);
    }

    // ✅ Update aadhaar if new file uploaded
    if (req.files?.aadhaarFile) {
      updateData.aadhaarFile = fileToBase64(req.files.aadhaarFile[0]);
    }

    // ✅ Update pan if new file uploaded
    if (req.files?.panFile) {
      updateData.panFile = fileToBase64(req.files.panFile[0]);
    }

    const updatedUser = await SignUp.findOneAndUpdate(
      { employeeId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    /* 🔔 ROLE-BASED NOTIFICATION */
    await createRoleBasedNotification({
      type: "EMPLOYEE_UPDATED",
      title: "Employee Updated",
      message: `${updatedUser.ename} details were updated by ${req.user.role}`,
      module: "employee",
      refId: updatedUser._id,
      actorUserId: req.user.id,               // JWT id
      actorRole: req.user.role.toLowerCase(), // normalized
    });

    res.json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("updateUser error:", error);
    res.status(500).json({ message: error.message });
  }
};


// const deleteUser = async (req, res) => {
//     try {
//         const deletedUser = await SignUp.findOneAndDelete({
//         employeeId: req.params.employeeId,
//         }).sort({ createdAt: -1 });

//         if (!deletedUser) {
//         return res.status(404).json({ message: "User not found" });
//         }

//         return res.status(200).json({ message: "User deleted successfully" });
//     } catch (error) {
//         return res.status(500).json({ error: error.message });
//     }
//     };

const deleteUser = async (req, res) => {
  try {
    // 🔐 Ensure auth
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { employeeId } = req.params;

    const deletedUser = await SignUp.findOneAndDelete({
      employeeId,
    }).sort({ createdAt: -1 });

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await releaseEmployeeId({
      employeeId: deletedUser.employeeId,
      userId: deletedUser._id,
      reason: "deleted",
    });

    /* 🔔 ROLE-BASED NOTIFICATION */
    await createRoleBasedNotification({
      type: "EMPLOYEE_DELETED",
      title: "Employee Deleted",
      message: `${deletedUser.ename} was deleted by ${req.user.role}`,
      module: "employee",
      refId: deletedUser._id,
      actorUserId: req.user.id,               // JWT id
      actorRole: req.user.role.toLowerCase(), // normalized
    });

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete User Error:", error);
    return res.status(500).json({ message: error.message });
  }
};



module.exports = { updateUser, deleteUser };

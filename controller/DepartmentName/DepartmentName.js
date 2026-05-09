const Department = require('../../model/Department/AddDepartment');
const Notification = require("../../model/Notification/NotificationForAll");
const { getIO } = require("../../socket");
const createRoleBasedNotification = require(
  "../../utils/createRoleBasedNotification"
);
    
const addDepartment = async (req, res) => {
  try {
    console.log("rehjsvdfd",req.body,res);
    debugger
    // if (!req.user) {
    //   return res.status(401).json({
    //     message: "Unauthorized: user context missing",
    //   });
    // }

    const { deptName } = req.body;

    if (!deptName) {
      return res.status(400).json({ message: "Department name required" });
    }

    const existingDept = await Department.findOne({
      deptName: { $regex: `^${deptName}$`, $options: "i" },
    });

    if (existingDept) {
      return res.status(400).json({ message: "Department already exists" });
    }

    const department = await Department.create({ deptName });
    if (req.user?.id && req.user?.role) {
      await createRoleBasedNotification({
        type: "DEPARTMENT_CREATED",
        title: "New Department Added",
        message: `${deptName} department was added by ${req.user.role}`,
        module: "department",
        refId: department._id,
        actorUserId: req.user.id,
        actorRole: req.user.role.toLowerCase(),
      });
    }

    res.status(201).json({
      message: "Department added successfully",
      data: department,
    });
  } catch (error) {
    console.error("Add Department Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ createdAt: -1 });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getDepartmentByid = async(req , res)=>{
  try {
    const { id } = req.params; 

    const dept = await Department.findById(id); 

    if (!dept) {
      return res.status(404).json({ message: "Department not found" });
    }

    res.json(dept); 
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
}

const updateDepartment = async (req, res) => {
  try {
    // 🔐 Ensure user context exists
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized: user context missing",
      });
    }

    const { id } = req.params;
    const { deptName } = req.body;

    if (!deptName) {
      return res.status(400).json({ message: "Department name required" });
    }

    const updateDept = await Department.findByIdAndUpdate(
      id,
      { deptName },
      { new: true, runValidators: true }
    );

    if (!updateDept) {
      return res.status(404).json({ message: "Department not found" });
    }

    /* 🔔 ROLE-BASED NOTIFICATION */
    await createRoleBasedNotification({
      type: "DEPARTMENT_UPDATED",
      title: "Department Updated",
      message: `${deptName} department was updated by ${req.user.role}`,
      module: "department",
      refId: updateDept._id,
      actorUserId: req.user.id,              // ✅ correct (JWT payload)
      actorRole: req.user.role.toLowerCase() // ✅ normalized
    });

    res.json({
      message: "Department updated successfully",
      data: updateDept,
    });
  } catch (error) {
    console.error("Update Department Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    // 🔐 ensure auth
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const deletedDept = await Department.findByIdAndDelete(id);

    if (!deletedDept) {
      return res.status(404).json({ message: "Department not found" });
    }

    /* 🔔 ROLE-BASED DELETE NOTIFICATION */
    await createRoleBasedNotification({
      type: "DEPARTMENT_DELETED",
      title: "Department Deleted",
      message: `${deletedDept.deptName} department was deleted by ${req.user.role}`,
      module: "department",
      refId: deletedDept._id,
      actorUserId: req.user.id,               // ✅ JWT id
      actorRole: req.user.role.toLowerCase(), // ✅ normalized
    });

    res.json({ message: "Department deleted successfully" });
  } catch (error) {
    console.error("Delete Department Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


module.exports = { addDepartment , getDepartments , updateDepartment  , getDepartmentByid , deleteDepartment};

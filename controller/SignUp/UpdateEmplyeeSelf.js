const SignUp = require("../../model/SignUp/SignUp");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// ✅ Employee self-update API
const updateSelfProfile = async (req, res) => {
  try {
    const employeeParam = req.user?.id || req.params.id;
    if (!employeeParam) return res.status(400).json({ message: "Employee ID missing" });

    let updates = { ...req.body };

    // whitelist fields
    const allowedFields = ["ename","phoneNo","personal_email","address","emergencyContact","relation","qualification","lastExp","img","resumeFile","fatherName","motherName","dateOfBirth","gender","accountNo","bankName","ifscCode"];
    Object.keys(updates).forEach(key => {
      if (!allowedFields.includes(key)) delete updates[key];
    });

    // files
    if (req.files) {
      if (req.files.img && req.files.img[0]) updates.img = `${req.protocol}://${req.get("host")}/uploads/images/${req.files.img[0].filename}`;
      if (req.files.resumeFile && req.files.resumeFile[0]) updates.resumeFile = `${req.protocol}://${req.get("host")}/uploads/resumes/${req.files.resumeFile[0].filename}`;
    }

    // decide lookup by ObjectId vs employeeId
    let updatedUser;
    if (mongoose.Types.ObjectId.isValid(employeeParam)) {
      updatedUser = await SignUp.findByIdAndUpdate(employeeParam, { $set: updates }, { new: true, runValidators: true });
    } else {
      updatedUser = await SignUp.findOneAndUpdate({ employeeId: employeeParam }, { $set: updates }, { new: true, runValidators: true });
    }

    if (!updatedUser) return res.status(404).json({ message: "Employee not found" });

    // return updated resource directly (simple)
    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error('updateSelfProfile error:', error);
    return res.status(500).json({ message: error.message });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const id = req.params.id;
    let employee;

    // If it's a valid Mongo ObjectId → search by _id
    if (mongoose.Types.ObjectId.isValid(id)) {
      employee = await SignUp.findById(id)
        .populate('department')
        .populate('service');
    } 
    else {
      // Otherwise treat it as custom employeeId
      employee = await SignUp.findOne({ employeeId: id })
        .populate('department')
        .populate('service');
    }

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.status(200).json(employee);
  } catch (error) {
    console.error("Error in getEmployeeById:", error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { updateSelfProfile  , getEmployeeById};

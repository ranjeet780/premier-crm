
const bcrypt = require('bcrypt');
const SignUpSchema = require('../../model/SignUp/SignUp');
const jobOpening = require('../../model/JobOpening/JobOpening');
const createRoleBasedNotification = require(
  "../../utils/createRoleBasedNotification"
);
const { claimReusableEmployeeId } = require("../../utils/employeeIdAllocator");
const fileToBase64 = require("../../utils/fileToBase64");


// const SignUpController = async (req, res) => {
//   try {
//     const {
//       ename, dateOfBirth, gender, phoneNo,
//       personal_email, official_email, password, fatherName,
//       motherName, address, emergencyContact,
//       relation, bankName, accountNo, ifscCode,
//       accountHolderName, adarCardNo,
//       panNo, qualification, lastExp, expWithPWT,
//       department, service,
//       interviewDate, joiningDate, expectedSalary, givenSalary,
//       workingTime, userType, traineeDuration, jobId
//     } = req.body;

//     const resumeFile = req.files?.resumeFile
//       ? `${req.protocol}://${req.get("host")}/uploads/resumes/${req.files.resumeFile[0].filename}`
//       : null;

//     const img = req.files?.img
//       ? `${req.protocol}://${req.get("host")}/uploads/images/${req.files.img[0].filename}`
//       : null;

//     // ✅ check if email already exists
//     const user = await SignUpSchema.findOne({ personal_email });
//     if (user) {
//       return res.status(400).json({ message: "Email id already exists" });
//     }

//     // ✅ hash password
//     const hashPassword = await bcrypt.hash(password, 10);

//     // ✅ create new employee
//     const newUser = new SignUpSchema({
//       ename, dateOfBirth, gender, phoneNo,
//       personal_email, official_email, password: hashPassword, fatherName,
//       motherName, address, emergencyContact,
//       relation, bankName, accountNo, ifscCode,
//       accountHolderName, adarCardNo,
//       panNo, qualification, lastExp, expWithPWT,
//       department: department, service: service,
//       interviewDate, joiningDate, expectedSalary, givenSalary,
//       workingTime, resumeFile, img, userType, traineeDuration, jobId
//     });

//     const saveUser = await newUser.save();

//     // ✅ update job opening (increment selected employees)
//     await jobOpening.findOneAndUpdate(
//       { jobId },
//       { $inc: { selected_emp: 1 } },
//       { new: true }
//     ).sort({ createdAt: -1 });

//     return res.status(201).json({
//       message: "Employee added and job updated successfully",
//       employee: saveUser
//     });

//   } catch (error) {
//     console.error(error.message);
//     res.status(500).json({ message: error.message });
//   }
// };

const SignUpController = async (req, res) => {
  try {
    const {
      ename, dateOfBirth, gender, phoneNo,
      personal_email, official_email, password, fatherName,
      motherName, address, emergencyContact,
      relation, bankName, accountNo, ifscCode, bankAddress,
      accountHolderName, adarCardNo,
      panNo, qualification, lastExp, expWithPWT,
      department, service,
      interviewDate, joiningDate, expectedSalary, givenSalary,
      workingTime, userType, traineeDuration, jobId
    } = req.body;

    const personalEmailNorm = String(personal_email || "").trim().toLowerCase();
    const officialEmailNorm = String(official_email || "").trim().toLowerCase();
    const phoneNorm = String(phoneNo || "").trim();

    if (!officialEmailNorm) {
      return res.status(400).json({ message: "Official email is required" });
    }

    const resumeFile = req.files?.resumeFile
      ? fileToBase64(req.files.resumeFile[0])
      : null;

    const img = req.files?.img
      ? fileToBase64(req.files.img[0])
      : null;

    const aadhaarFile = req.files?.aadhaarFile
      ? fileToBase64(req.files.aadhaarFile[0])
      : null;

    const panFile = req.files?.panFile
      ? fileToBase64(req.files.panFile[0])
      : null;

    // ✅ robust duplicate checks (ignore empty optional personal email)
    const dupChecks = [{ official_email: officialEmailNorm }];
    if (personalEmailNorm) dupChecks.push({ personal_email: personalEmailNorm });
    if (phoneNorm) dupChecks.push({ phoneNo: phoneNorm });

    const existing = await SignUpSchema.findOne({ $or: dupChecks }).lean();
    if (existing) {
      if (existing.official_email === officialEmailNorm) {
        return res.status(400).json({ message: "Official email already exists" });
      }
      if (personalEmailNorm && existing.personal_email === personalEmailNorm) {
        return res.status(400).json({ message: "Personal email already exists" });
      }
      if (phoneNorm && existing.phoneNo === phoneNorm) {
        return res.status(400).json({ message: "Phone number already exists" });
      }
      return res.status(400).json({ message: "Employee already exists with same details" });
    }

    // ✅ hash password
    const hashPassword = await bcrypt.hash(password, 10);

    // ✅ create new employee
    const reusableEmployeeId = await claimReusableEmployeeId();

    const newUser = new SignUpSchema({
      ename, dateOfBirth, gender, phoneNo,
      personal_email: personalEmailNorm || undefined,
      official_email: officialEmailNorm,
      password: hashPassword, fatherName,
      motherName, address, emergencyContact,
      relation, bankName, accountNo, ifscCode, bankAddress,
      accountHolderName, adarCardNo,
      panNo, qualification, lastExp, expWithPWT,
      department, service,
      interviewDate, joiningDate, expectedSalary, givenSalary,
      workingTime, resumeFile, img, aadhaarFile, panFile, userType, traineeDuration, jobId,
      ...(reusableEmployeeId ? { employeeId: reusableEmployeeId } : {})
    });

    let saveUser;
    try {
      saveUser = await newUser.save();
    } catch (saveErr) {
      if (saveErr?.code === 11000) {
        const dupField = Object.keys(saveErr.keyPattern || {})[0];
        const fieldMap = {
          official_email: "Official email already exists",
          personal_email: "Personal email already exists",
          phoneNo: "Phone number already exists",
          employeeId: "Employee ID collision. Please try again",
        };
        return res.status(400).json({ message: fieldMap[dupField] || "Duplicate value found" });
      }
      throw saveErr;
    }

    // ✅ update job opening (increment selected employees)
    await jobOpening.findOneAndUpdate(
      { jobId },
      { $inc: { selected_emp: 1 } },
      { new: true }
    );

    // Send admin notification only when created by an authenticated admin user.
    if (req.user?._id && req.user?.role) {
      await createRoleBasedNotification({
        type: "EMPLOYEE_CREATED",
        title: "New Employee Added",
        message: `${ename} was added as ${userType} by ${req.user.role}`,
        module: "employee",
        refId: saveUser._id,
        actorUserId: req.user._id,
        actorRole: String(req.user.role).toLowerCase(),
      });
    }

    return res.status(201).json({
      message: "Employee added and job updated successfully",
      employee: saveUser
    });

  } catch (error) {
    console.error("SignUp Error:", error);
    res.status(500).json({ message: error.message });
  }
};


const getEmployeesByService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    if (!serviceId) return res.status(400).json({ message: "Service ID required" });

    const employees = await SignUpSchema.find({ service: serviceId })
      .select("ename personal_email")  // pick fields you need
      .lean();

    // Return as { _id, name } for frontend
    const formatted = employees.map(emp => ({
      _id: emp._id,
      name: emp.ename
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


module.exports = { SignUpController, getEmployeesByService };

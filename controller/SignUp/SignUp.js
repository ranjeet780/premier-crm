
const nodemailer = require("nodemailer");
const bcrypt = require('bcrypt');
const SignUpSchema = require('../../model/SignUp/SignUp');
const jobOpening = require('../../model/JobOpening/JobOpening');
const createRoleBasedNotification = require(
  "../../utils/createRoleBasedNotification"
);
const { claimReusableEmployeeId } = require("../../utils/employeeIdAllocator");
const fileToBase64 = require("../../utils/fileToBase64");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

function getFrontendBaseUrl() {
  const fromEnv = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "http://localhost:3000";
}


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

    // Send registration welcome email to the newly added employee
    try {
      const frontendBaseUrl = getFrontendBaseUrl();
      const recipients = [officialEmailNorm];
      if (personalEmailNorm && personalEmailNorm !== officialEmailNorm) {
        recipients.push(personalEmailNorm);
      }

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: recipients.join(", "),
        subject: "Welcome to Premier Webtech - Employee Registration",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <div style="background: #003e6d; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
              <h2 style="color: #ffffff; margin: 0;">Premier Webtech</h2>
              <p style="color: #cbd5e1; margin: 5px 0 0 0;">Employee Account Created</p>
            </div>
            <div style="padding: 24px;">
              <h3 style="color: #1e293b;">Hello ${ename},</h3>
              <p style="font-size: 15px; color: #475569; line-height: 1.5;">
                Welcome to <strong>Premier Webtech</strong>! Your employee account has been successfully registered. Below are your account details and login credentials:
              </p>

              <div style="background: #f8fafc; border-left: 4px solid #003e6d; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 4px 0; font-size: 14px;"><strong>Employee ID:</strong> ${saveUser.employeeId || 'N/A'}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Official Email:</strong> ${officialEmailNorm}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Password:</strong> ${password}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Position / Role:</strong> ${userType || 'Employee'}</p>
              </div>

              <p style="font-size: 14px; color: #64748b;">
                You can log in to the portal using the link below to access your workspace:
              </p>

              <div style="text-align: center; margin: 25px 0;">
                <a href="${frontendBaseUrl}/login" style="background-color: #003e6d; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Log In to Account</a>
              </div>

              <p style="font-size: 12px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                If you have any questions or did not expect this email, please contact HR administration immediately.
              </p>
            </div>
          </div>
        `,
      });
      console.log(`✉️ Welcome email sent successfully to ${recipients.join(", ")}`);
    } catch (emailErr) {
      console.error("Error sending employee welcome email:", emailErr);
    }

    return res.status(201).json({
      message: "Employee added and registration email sent successfully",
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

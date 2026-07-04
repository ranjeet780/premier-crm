const ClientLeadData = require('../../model/ClientLead/ClientLead')
const otpGenerator = require('otp-generator'); // npm install otp-generator
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const fs = require("fs");
const path = require("path");
const jwt = require('jsonwebtoken'); 
const createRoleBasedNotification = require(
  "../../utils/createRoleBasedNotification"
);


const Gen_ClientLead = async (req, res) => {
  try {
    // 🔐 Ensure auth
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      leadName, emailId, phoneNo, sourse,
      department, service, project_type,
      project_price, start_date, deadline,
      startProjectDate, date, status, assign,
      userType, accountNo, ifscCode, gstNumber,
      bankName, accountHolderName, adarCardNo, panNo
    } = req.body;

    // ✅ check duplicate by email
    const user = await ClientLeadData.findOne({ emailId });
    if (user) {
      return res.status(400).json({ message: "User Already Exists" });
    }

    const newClient = new ClientLeadData({
      leadName, emailId, phoneNo, sourse,
      department, service, project_type,
      project_price, start_date, deadline,
      startProjectDate, date, status,
      assign, userType, accountNo, ifscCode, gstNumber,
      bankName, accountHolderName, adarCardNo, panNo
    });

    const savedLead = await newClient.save();

    /* 🔔 ROLE-BASED NOTIFICATION */
    await createRoleBasedNotification({
      type: "CLIENT_LEAD_CREATED",
      title: "New Client Lead Added",
      message: `${leadName} client lead was created by ${req.user.role}`,
      module: "client-lead",
      refId: savedLead._id,
      actorUserId: req.user.id,               // JWT id
      actorRole: req.user.role.toLowerCase(), // normalized
    });

    res.status(200).json({
      message: "User Added Successfully",
      lead: savedLead,
    });

  } catch (error) {
    console.error("Client Lead Error:", error);
    res.status(500).json({ message: error.message });
  }
};



const Get_ClientLead = async (req, res) => {
    try {
        const data = await ClientLeadData.find().sort({ createdAt: -1 });
        return res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;

    // Search by leadId instead of _id
    const lead = await ClientLeadData.findOne({ leadId: id, userType: "lead" })
      .populate("department", "deptName")
      .populate("service", "serviceName")
      .populate("assign", "ename email");

    if (!lead) {
      return res.status(404).json({ message: "Lead not found or not a lead" });
    }

    res.status(200).json({ success: true, lead });
  } catch (error) {
    console.error("❌ Error fetching lead by id:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const deleteLead = async ( req , res)=>{
    try {
        const deletedUser = await ClientLeadData.findOneAndDelete({
            leadId: req.params.leadId,
        });

        if (!deletedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({ message: "User deleted successfully" });
    
        
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

const sendOtpEmail = async ({ email, name, otp }) => {
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const logoBuffer = fs.readFileSync(path.join(__dirname, "..", "uploads", "logo", "premier-logo.png"));

  const mailOptions = {
    from: `"Premier WEBTECH" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Premier WEBTECH: Your OTP to Set Portal Password",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="cid:companylogo" style="width:130px;" />
        </div>
        <h2 style="color: #1a237e; text-align: center;">OTP Verification Required</h2>
        <p>Hello${name ? " <strong>" + name + "</strong>" : ""},</p>
        <p>Thank you for starting your client portal setup with Premier WEBTECH.</p>
        <p><b>Your OTP code:</b>
           <span style="font-size: 20px; color: #1565c0;">${otp}</span>
        </p>
        <p>This code is valid for <b>10 minutes</b>. Please enter it on the password creation page to proceed.</p>
        <hr>
        <p style="font-size: 12px; color: #888;">If you did not initiate this request, please contact our support team immediately.</p>
        <div style="text-align: center; margin-top:30px; color:#666;">
          <b>Premier WEBTECH</b>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: "premier-logo.png",
        content: logoBuffer,
        cid: "companylogo",
      },
    ],
  };

  await transporter.sendMail(mailOptions);
};

const sendPasswordSetupOtp = async (req, res) => {
  try {
    const { emailId } = req.body;
    const client = await ClientLeadData.findOne({ emailId });

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Generate 6-digit OTP
    const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, alphabets: false });
    const otpExpires = new Date(Date.now() + 10 * 60000); // 10 min expiry

    client.otp = otp;
    client.otpExpires = otpExpires;
    await client.save();

    await sendOtpEmail({
      email: emailId,
      name: client.leadName,
      otp
    });
    res.status(200).json({ message: 'OTP sent to email' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



const createPassword = async (req, res) => {
  try {
    const { emailId, otp, password } = req.body;
    const client = await ClientLeadData.findOne({ emailId });

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (client.otp !== otp || client.otpExpires < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);
    client.password = hashedPassword;
    client.otp = undefined;
    client.otpExpires = undefined;
    client.isEmailVerified = true; // optional flag
    await client.save();

    res.status(200).json({ message: 'Password created successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const clientLogin = async (req, res) => {
  try {
    const { emailId, password } = req.body;
    const client = await ClientLeadData.findOne({ emailId }).select('+password'); // FIX: ensure password is included

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    if (!client.isEmailVerified) {
      return res.status(403).json({ message: "Email not verified. Please set your password by verifying OTP." });
    }
    if (!client.password) {
      return res.status(400).json({ message: "No password set. Please use password setup." });
    }

    const isMatch = await bcrypt.compare(password, client.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    // JWT logic here as before
    const token = jwt.sign(
      { userId: client._id, emailId: client.emailId, userType: client.userType || "client" },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful",
      client: {
        _id: client._id,
        leadName: client.leadName,
        emailId: client.emailId
      },
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


module.exports = { Gen_ClientLead, Get_ClientLead , deleteLead  , getLeadById , sendOtpEmail ,sendPasswordSetupOtp ,
  createPassword , clientLogin


};

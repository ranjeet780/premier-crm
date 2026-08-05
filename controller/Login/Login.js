const bcrypt = require("bcryptjs");
const User = require("../../model/Users/Users");
const jwt = require("jsonwebtoken");
const { createAuditLog, getClientIp } = require("../../utils/logActivity");

const LoginAdmin = async (req, res) => {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "Unknown";
  const rawEmail = req.body.official_email || req.body.email || "";

  try {
    const password = req.body.password || "";
    const role = req.body.role || "";

    // ✅ INPUT VALIDATION
    if (!rawEmail.trim()) {
      return res.status(400).json({ message: "Please enter your email" });
    }

    if (!password) {
      return res.status(400).json({ message: "Please enter your password" });
    }

    if (!role.trim()) {
      return res.status(400).json({ message: "Please select a role" });
    }

    // ✅ FIND USER BY EMAIL
    const user = await User.findOne({
      email: rawEmail.toLowerCase().trim(),
    });

    if (!user) {
      await createAuditLog({
        userName: "Unknown",
        userEmail: rawEmail,
        userRole: role || "unknown",
        action: "FAILED_LOGIN",
        status: "FAILED",
        ipAddress,
        userAgent,
        details: "User not found",
      });
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ ROLE VALIDATION
    const dbRole = String(user.role || "")
      .toLowerCase()
      .trim()
      .replace(/[\s_-]+/g, "");
    const selectedRole = String(role || "")
      .toLowerCase()
      .trim()
      .replace(/[\s_-]+/g, "");

    if (dbRole !== selectedRole) {
      await createAuditLog({
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        userId: user._id,
        action: "FAILED_LOGIN",
        status: "FAILED",
        ipAddress,
        userAgent,
        details: `Role mismatch: selected '${role}' but assigned '${user.role}'`,
      });
      return res.status(400).json({
        message: "Invalid role selected. Please select your assigned role.",
      });
    }

    // ✅ PASSWORD CHECK
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await createAuditLog({
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        userId: user._id,
        action: "FAILED_LOGIN",
        status: "FAILED",
        ipAddress,
        userAgent,
        details: "Incorrect password",
      });
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ✅ SUCCESS LOG
    await createAuditLog({
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      userId: user._id,
      action: "LOGIN",
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: "Admin portal login successful",
    });

    // ✅ JWT
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        permissions: user.permissions || {},
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        role: user.role,
        email: user.email,
        permissions: user.permissions || {},
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login error" });
  }
};

module.exports = { LoginAdmin };

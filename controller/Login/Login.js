const bcrypt = require("bcryptjs");
const User = require("../../model/Users/Users");
const jwt = require("jsonwebtoken");

const LoginAdmin = async (req, res) => {
  try {
    const rawEmail = req.body.official_email || req.body.email || "";
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
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ ROLE VALIDATION: Selected role MUST match user's assigned role in database
    const dbRole = (user.role || "").toLowerCase().replace(/\s+/g, "");
    const selectedRole = (role || "").toLowerCase().replace(/\s+/g, "");

    if (dbRole !== selectedRole) {
      return res.status(400).json({
        message: "Invalid role selected. Please select your assigned role.",
      });
    }

    // ✅ PASSWORD CHECK
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ✅ JWT (ROLE COMES FROM DB VERIFIED RECORD)
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

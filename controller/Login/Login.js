const bcrypt = require("bcryptjs");
const User = require("../../model/Users/Users");
const jwt = require("jsonwebtoken");

const LoginAdmin = async (req, res) => {
  const { official_email, password } = req.body;

  try {
    // ✅ FIND USER BY EMAIL ONLY
    const user = await User.findOne({
      email: official_email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ PASSWORD CHECK
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ✅ JWT (ROLE COMES FROM DB)
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

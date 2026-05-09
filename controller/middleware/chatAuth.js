const jwt = require("jsonwebtoken");
const User = require("../../model/Users/Users");
const SignUp = require("../../model/SignUp/SignUp");

const chatAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded._id;

    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const adminUser = await User.findById(userId).select("_id role name").lean();
    if (adminUser) {
      req.user = {
        _id: String(adminUser._id),
        role: adminUser.role,
        name: adminUser.name || "Admin",
        source: "admin",
      };
      return next();
    }

    const employee = await SignUp.findById(userId).select("_id role ename").lean();
    if (employee) {
      req.user = {
        _id: String(employee._id),
        role: employee.role || "employee",
        name: employee.ename || "Employee",
        source: "employee",
      };
      return next();
    }

    return res.status(401).json({ message: "User not found" });
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = chatAuth;

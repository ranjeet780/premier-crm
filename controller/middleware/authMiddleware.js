const jwt = require("jsonwebtoken");
const User = require("../../model/Users/Users");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("_id role");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user; // ✅ real mongoose document

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const optionalAuthMiddleware = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id role");

    req.user = user || null;
    return next();
  } catch (_error) {
    req.user = null;
    return next();
  }
};

module.exports = authMiddleware;
module.exports.optionalAuthMiddleware = optionalAuthMiddleware;

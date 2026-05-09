const ACTION_INDEX_MAP = {
  0: "view",
  1: "add",
  2: "edit",
  3: "delete",
};

const cleanKey = (value = "") =>
  String(value).toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "");

const hasAction = (perms, action) => {
  const wanted = cleanKey(action);

  if (Array.isArray(perms)) {
    return perms.some((item) => {
      const normalized = ACTION_INDEX_MAP[String(item).trim().toLowerCase()] || cleanKey(item);
      return normalized === wanted;
    });
  }

  if (perms && typeof perms === "object") {
    return perms[wanted] === true;
  }

  return false;
};

module.exports = function checkPermission(moduleKey, action = "View") {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    const role = (user.role || "").toLowerCase();
    if (["superadmin", "manager"].includes(role)) {
      return next();
    }

    const perms = user.permissions?.[cleanKey(moduleKey)] ?? user.permissions?.[moduleKey];
    if (hasAction(perms, action)) {
      return next();
    }

    return res.status(403).json({ msg: "Permission Denied" });
  };
};

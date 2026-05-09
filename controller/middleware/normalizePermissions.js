module.exports = function normalizePermissions(req, res, next) {
  if (!req.user || !req.user.permissions) return next();

  const normalized = {};

  Object.keys(req.user.permissions).forEach((key) => {
    // normalize keys to camelCase without spaces
    const cleanKey = key
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z]/g, "");

    normalized[cleanKey] = req.user.permissions[key];
  });

  // map known modules safely
  req.user.permissions = {
    jobOpenings: normalized.jobopening || normalized.jobopenings,
    employees: normalized.employees,
    tasks: normalized.tasks,
    attendance: normalized.attendance,
    leads: normalized.leads,
    clients: normalized.clients,
    proposals: normalized.proposals,
    projects: normalized.projects,
    invoices: normalized.invoices,
    salaries: normalized.salaries,
  };

  next();
};

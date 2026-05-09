const Role = require('../../model/Roles/Roles');

// Create a new role
exports.createRole = async (req, res) => {
  try {
    const role = new Role(req.body);
    await role.save();
    res.json(role);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all roles
exports.getRoles = async (req, res) => {
  const roles = await Role.find();
  res.json(roles);
};

// Save/Update module permissions to a role
exports.setPermissions = async (req, res) => {
  const { roleId } = req.params;
  const { moduleName, permissions } = req.body;
  const role = await Role.findById(roleId);

  if (!role) return res.status(404).json({ error: 'Role not found' });

  const mod = role.modules.find(m => m.moduleName === moduleName);
  if (mod) {
    mod.permissions = permissions;
  } else {
    role.modules.push({ moduleName, permissions });
  }

  await role.save();
  res.json(role);
};

// Get permissions for a role
exports.getPermissions = async (req, res) => {
  const { roleId } = req.params;
  const role = await Role.findById(roleId);
  if (!role) return res.status(404).json({ error: 'Role not found' });
  res.json(role.modules);
};

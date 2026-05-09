const express = require('express');
const router = express.Router();
const {
  createRole,
  getRoles,
  setPermissions,
  getPermissions
} = require('../controller/Roles/Roles');

// POST create a new role
router.post('/', createRole);

// GET all roles
router.get('/', getRoles);

// POST/PUT permissions for a role
router.post('/:roleId/permissions', setPermissions);

// GET permissions for a specific role
router.get('/:roleId/permissions', getPermissions);

module.exports = router;

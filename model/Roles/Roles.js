const mongoose = require('mongoose');

const ModuleSchema = new mongoose.Schema({
  moduleName: String,
  permissions: [String], // ["Add", "Edit", "View", "Delete"]
});

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  modules: [ModuleSchema]
});

module.exports = mongoose.model('Role', RoleSchema);

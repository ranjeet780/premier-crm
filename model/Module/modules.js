const mongoose = require("mongoose");

const ModuleSchema = new mongoose.Schema({
  key: { type: String, unique: true }, // jobOpenings
  label: String,                       // Job Openings
  actions: [String]                    // ["View","Add","Edit","Delete"]
});

module.exports = mongoose.model("Module", ModuleSchema);

const mongoose = require("mongoose");

const EmployeeServiceMapSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SignUp",
    required: true,
  },
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "service",
  }]
}, { timestamps: true });

module.exports = mongoose.model("EmployeeServiceMap", EmployeeServiceMapSchema);

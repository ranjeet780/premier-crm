const mongoose = require('mongoose');
const Counter = require('../Counter/Counter');

const departmentSchema = new mongoose.Schema({
  deptName: {
    type: String,
    required: true,
    unique: true
  },
  deptId: {
    type: String,
    unique: true 
  }
}, { timestamps: true });

departmentSchema.pre('save', async function (next) {
  if (!this.isNew || this.deptId) return next();

  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: 'deptId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const year = new Date().getFullYear();
    const seqNum = String(counter.seq).padStart(5, '0');
    this.deptId = `DEPT${year}-${seqNum}`;

    next();
  } catch (err) {
    next(err);
  }
});

const Department = mongoose.model('department', departmentSchema);
module.exports = Department;

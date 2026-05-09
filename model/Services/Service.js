const mongoose = require('mongoose');
const Counter = require('../Counter/Counter');

const ServiceSchema = new mongoose.Schema({
  serviceName: {
    type: String,
    required: true,
  },
    servicePrice: {
    type: Number,
    required: true,
  },
  deptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "department", 
    required: true,
  },
  serviceId: {
    type: String, 
    unique: true,
  },
  is_recurring: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

ServiceSchema.pre('save', async function (next) {
  if (!this.isNew || this.serviceId) return next();

  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: 'serviceId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const year = new Date().getFullYear();
    const seqNum = String(counter.seq).padStart(5, '0');
    this.serviceId = `SERVICE${year}-${seqNum}`;

    next();
  } catch (err) {
    next(err);
  }
});

const Service = mongoose.model('service', ServiceSchema);
module.exports = Service;

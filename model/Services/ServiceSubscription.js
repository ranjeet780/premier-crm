const mongoose = require('mongoose');

const ServiceSubscriptionSchema = new mongoose.Schema({
  service_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'service',
    required: true,
    unique: true,
  },
  service_name: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01,
  },
  start_date: {
    type: Date,
    required: true
  },
  // Legacy field kept optional for backward compatibility.
  end_date: {
    type: Date,
    required: false
  },
  // Legacy field kept optional for backward compatibility.
  billing_cycle: {
    type: String,
    enum: ['Monthly', 'Quarterly', 'Yearly'],
    required: false
  },
  duration_value: {
    type: Number,
    required: true,
    min: 1,
  },
  renewal_type: {
    type: String,
    required: true,
    enum: ['weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly'],
  },
  next_billing_date: {
    type: Date,
    required: true
  },
  reminder_days_before: {
    type: Number,
    min: 0,
    default: 3,
  },
  last_reminder_for: {
    type: Date,
    default: null,
  },
  reminder_offsets_sent: {
    type: [Number],
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('ServiceSubscription', ServiceSubscriptionSchema);

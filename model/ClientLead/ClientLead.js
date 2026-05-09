const mongoose = require('mongoose');
const Counter = require('../Counter/Counter');

const ClientLeadSchema = new mongoose.Schema({
  leadName: { type: String, required: true },
  emailId: { type: String, required: true },
  password: { type: String, select: false },      // Hash only, never return raw password
  otp: String,                                   // Store OTP (hashed or plain for dev, hashed for prod)
  otpExpires: Date,                              // When OTP expires
  isEmailVerified: { type: Boolean, default: false },
  phoneNo: { type: String, required: true },
  sourse: { type: String },

  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "department",
    required: true
  },

  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "service"
  },

  project_type: { type: String },
  project_price: { type: String },
  bankName: { type: String, default: "" },
  accountNo: { type: String, default: "" },
  ifscCode: { type: String, default: "" },
  accountHolderName: { type: String, default: "" },
  adarCardNo: { type: String, default: "" },
  panNo: { type: String, default: "" },
  gstNumber: { type: String, default: "" },

  start_date: {
    type: Date,
    get: (val) => val ? val.toISOString().split("T")[0] : null 
  },
  deadline: {
    type: Date,
    get: (val) => val ? val.toISOString().split("T")[0] : null 
  },
  startProjectDate: { type: Date },

  date: {
    type: Date,
    default: Date.now,
    get: (val) => val ? val.toISOString().split("T")[0] : null 
  },

  status: {
    type: String,
    enum: [
      "Cold","Warm","Hot",
      "Schedule Appointment",
      "Proposal sent",
      "Win","Hold","Close","Other"
    ],
    default: "Cold"
  },

  assign: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SignUp"   // assuming employee model is SignUp
    }
  ],

  userType: {
    type: String,
    enum: ["client", "lead"],
    required: true
  },

  leadId: { type: String, unique: true },
  projects: [{ type: mongoose.Schema.Types.ObjectId, ref: "projects" }]
}, { timestamps: true });

ClientLeadSchema.pre('save', async function (next) {
  if (!this.isNew || this.leadId) return next();
  try {
    const counter = await Counter.findOneAndUpdate( 
      { _id: 'leadId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const year = new Date().getFullYear();
    const seqNum = String(counter.seq).padStart(5, '0');
    this.leadId = `ID${year}-${seqNum}`;
    next();
  } catch (err) {
    next(err);
  }
});


const ClientLead = mongoose.model('ClientLeads', ClientLeadSchema);
module.exports = ClientLead;

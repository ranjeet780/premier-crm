const mongoose = require("mongoose");
const Counter = require('../Counter/Counter');

const ProposalSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientLeads", required: true },
  title: String,
  services: [{ id: String, name: String, price: Number }],
  description: String,
  companyDescription: String,
  category: [{ type: String }],
  price: Number,
  terms: String,
  status: { type: String, enum: ["Draft", "Sent", "Accepted", "Rejected"], default: "Draft" }, // only used if not set!
  attachments: [String], 
  clientResponse: { type: String, default: "" },
  aiInsights: {
    score: { type: Number, default: 0 },
    summary: { type: String, default: "" },
    risks: [
      {
        severity: String,
        code: String,
        message: String,
        suggestion: String,
      },
    ],
    checklist: [
      {
        key: String,
        label: String,
        passed: Boolean,
      },
    ],
    metrics: {
      servicesCount: Number,
      totalPrice: Number,
      descriptionWords: Number,
      termsWords: Number,
      categoryCount: Number,
    },
  },
  purposalId: { type: String }
}, { timestamps: true });
ProposalSchema.pre('save', async function (next) {
  if (!this.isNew || this.purposalId) return next();

  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: 'purposalId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const year = new Date().getFullYear();
    const seqNum = String(counter.seq).padStart(5, '0');
    this.purposalId = `ID${year}-${seqNum}`;

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Proposal", ProposalSchema);


const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  method: { type: String }, // e.g. "UPI", "Bank Transfer", "Cash"
  note: { type: String },
  date: { type: Date, default: Date.now },
});

const invoiceSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ClientLeads",
    required: true,
  },

  clientEmail: { type: String, required: true },
  clientName: { type: String, required: true },
  clientGstNumber: { type: String, default: "" },
  clientAccountNo: { type: String, default: "" },

  projects: [
    {
      projectId: { type: mongoose.Schema.Types.ObjectId, ref: "projects" },
      projectName: String,
      name: String,
      amount: Number,
    },
  ],

  invoiceNumber: { type: String, unique: true },
  totalAmount: { type: Number, required: true },
  subTotalAmount: { type: Number, default: 0 },
  taxName: { type: String, default: "" },
  taxAmount: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["Pending", "Partial", "Paid", "Draft"],
    default: "Pending",
  },

  dueDate: Date,
  date: { type: Date, default: Date.now },
  paidAt: Date,
  paymentMethod: {
    type: String,
    enum: ["UPI", "Net Banking", "Debit Card", "Credit Card", "Cash", "Online"],
    default: "UPI",
  },

  // ✅ new array to store multiple payments
  payments: [paymentSchema],

  // ✅ other existing fields
  sentFrom: { type: String },
  isDraft: { type: Boolean, default: false },
});

module.exports = mongoose.model("Invoice", invoiceSchema);

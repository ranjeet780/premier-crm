const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema(
  {
    sourceServiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "service",
      default: null,
      index: true,
    },
    subscriber: {
      type: String,
      required: true,
      trim: true,
    },
    plan: {
      type: String,
      required: true,
      trim: true,
    },
    billingCycle: {
      type: String,
      required: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      required: true,
      trim: true,
    },
    billToAddress: {
      type: String,
      default: "",
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdDate: {
      type: Date,
      required: true,
    },
    expiringOn: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Paid", "Unpaid", "Partial"],
      default: "Unpaid",
    },
    signatureData: {
      type: String,
      default: "",
    },
    signatureMimeType: {
      type: String,
      default: "",
    },
    signatureUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("subscription", SubscriptionSchema);

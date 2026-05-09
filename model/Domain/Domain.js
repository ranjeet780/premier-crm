const mongoose = require("mongoose");

const DomainSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    plan: {
      type: String,
      required: true,
      trim: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    purchasedOn: {
      type: Date,
      required: true,
    },
    expireDate: {
      type: Date,
      required: true,
    },
    platform: {
      type: String,
      required: true,
      trim: true,
    },
    actualAmount: {
      type: Number,
      required: true,
    },
    paidAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Paid", "Unpaid"],
      default: "Unpaid",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("domain", DomainSchema);

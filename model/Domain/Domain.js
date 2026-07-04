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
      required: function() { return this.productType !== 'email'; },
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
      required: function() { return this.productType !== 'email'; },
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
    productType: {
      type: String,
      enum: ["domain", "hosting", "email"],
      default: "domain"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("domain", DomainSchema);

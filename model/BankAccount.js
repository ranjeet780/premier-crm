const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
    bankName: { type: String, required: true },
    accountName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true },
    accountCapital: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('BankAccount', bankAccountSchema);

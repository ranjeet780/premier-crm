const mongoose = require('mongoose');

const incomeSchema = new mongoose.Schema({
    source: { type: String, required: true },
    description: { type: String },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Income', incomeSchema);

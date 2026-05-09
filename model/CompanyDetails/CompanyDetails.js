const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: String,
  address: {
    street: String,
    city: String,
    state: String,
    zip: String,
    country: String,
  },
  phone: String,
  email: String,
  website: String,
  taxId: String,
  bank: {
    bankName: String,
    accountNumber: String,
    ifsc: String,
  },
  logoUrl: String,
});

module.exports = mongoose.model('Company', companySchema);

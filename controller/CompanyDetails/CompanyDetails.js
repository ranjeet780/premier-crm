const Company = require('../../model/CompanyDetails/CompanyDetails');

// Get all companies
exports.getCompany = async (req, res) => {
  const companies = await Company.find();
  res.json(companies);
};

// Create a company
exports.createCompany = async (req, res) => {
  const company = new Company(req.body);
  await company.save();
  res.json(company);
};

// Update a company
exports.updateCompany = async (req, res) => {
  const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(company);
};

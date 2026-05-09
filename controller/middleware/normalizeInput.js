// middleware/normalizeInput.js
const normalizeInput = (req, res, next) => {
  if (req.body.email) {
    req.body.email = req.body.email.toLowerCase().trim();
  }
  if (req.body.official_email) {
    req.body.official_email = req.body.official_email.toLowerCase().trim();
  }
  if (req.body.role) {
    req.body.role = req.body.role.toLowerCase().trim();
  }
  next();
};

module.exports = normalizeInput;

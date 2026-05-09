// controller/middleware/multerComment.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ensure upload folder exists
const uploadDir = path.join(process.cwd(), "controller", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // accept images and pdf/docs
  const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  if (allowed.test(ext)) cb(null, true);
  else cb(new Error("File type not supported"), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

module.exports = upload;

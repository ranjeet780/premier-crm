

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create storage dynamically based on field name or folderName
const makeStorage = (folderName) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      let folder = folderName || "others"; // default

      // Auto-assign folder based on fieldname
      if (!folderName) {
        if (file.fieldname === "resumeFile") folder = "resumes";
        else if (file.fieldname === "img") folder = "images";
        else if (file.fieldname === "addFile") folder = "projects";
        else if (file.fieldname === "attachments") folder = "proposals";
      }

      const uploadPath = path.join(__dirname, "..", "uploads", folder);

      // Create folder if it doesn't exist
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
    },
  });

// File filter: allow only certain file types
const fileFilter = (req, file, cb) => {
  const allowedExt = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".webp", ".avif"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExt.includes(ext)) cb(null, true);
  else cb(new Error("Invalid file type"), false);
};

// ✅ Reusable Multer instance
// Use .single(), .array(), or .fields() in the routes as needed
const uploadTo = (folderName) => multer({ storage: makeStorage(folderName), fileFilter });

module.exports = uploadTo;

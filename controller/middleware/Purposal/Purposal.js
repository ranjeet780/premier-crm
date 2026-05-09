    const multer = require("multer");
    const path = require("path");
    const fs = require("fs");


    const TEMP_DIR = path.join(__dirname, "..", "Purposal", "temp");
    if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, TEMP_DIR); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
    });

    const fileFilter = (req, file, cb) => {
    const allowedTypes = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error("Only PDF, DOC, DOCX, JPG, PNG files allowed"), false);
    }
    };

    const upload = multer({ storage, fileFilter });

    module.exports = upload;

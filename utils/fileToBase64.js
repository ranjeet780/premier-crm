const fs = require("fs");

/**
 * Reads a file from disk, returns its base64 data URL, and deletes the temporary file.
 * @param {Object} file - Multer file object
 * @returns {String|null} Base64 data URL
 */
function fileToBase64(file) {
  if (!file || !file.path) return null;
  try {
    const data = fs.readFileSync(file.path);
    const base64Str = `data:${file.mimetype};base64,${data.toString("base64")}`;
    
    // Delete temporary file from disk
    fs.unlink(file.path, (err) => {
      if (err) console.error("Error deleting file:", file.path, err);
    });
    
    return base64Str;
  } catch (err) {
    console.error("Error converting file to base64:", file, err);
    return null;
  }
}

module.exports = fileToBase64;

// Image uploads (profile photos). Three things are enforced here, not left to the browser:
//  - the stored file name is random and its extension comes from the checked type, never from what the client sent
//    (so "photo.html" can never be saved and later served as a page),
//  - the file's first bytes must really be a JPEG, PNG or WebP image,
//  - files over 2 MB are refused.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "public", "uploads");
const MAX_BYTES = 2 * 1024 * 1024;
const EXTENSION_BY_TYPE = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomBytes(16).toString("hex")}${EXTENSION_BY_TYPE[file.mimetype]}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => cb(null, Boolean(EXTENSION_BY_TYPE[file.mimetype])),
});

// Returns "image/jpeg" | "image/png" | "image/webp" when the bytes really are that image, otherwise null.
function sniffImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

function discard(file) {
  if (file && file.path) fs.unlink(file.path, () => {});
}

function reject(res, status, message) {
  return res.status(status).render("errors/400", { title: "Bad Request", message });
}

// Runs after multer. A file that is not a real image is deleted and the request is refused.
function checkImage(req, res, next) {
  if (!req.file) return next();
  let head;
  try {
    const fd = fs.openSync(req.file.path, "r");
    head = Buffer.alloc(12);
    const read = fs.readSync(fd, head, 0, 12, 0);
    fs.closeSync(fd);
    head = head.subarray(0, read);
  } catch {
    discard(req.file);
    return reject(res, 400, "That file could not be read. Please try again.");
  }
  if (sniffImageType(head) !== req.file.mimetype) {
    discard(req.file);
    return reject(res, 400, "That file is not a valid JPEG, PNG or WebP image.");
  }
  next();
}

// Use in a route as: router.post("/", ...imageUpload("image"), verifyCsrfTokenParsed, handler)
function imageUpload(field) {
  const single = upload.single(field);
  return [
    (req, res, next) =>
      single(req, res, (err) => {
        if (!err) return next();
        if (err.code === "LIMIT_FILE_SIZE") return reject(res, 400, "That image is too large. The limit is 2 MB.");
        if (err instanceof multer.MulterError) return reject(res, 400, "That upload was not accepted.");
        next(err);
      }),
    checkImage,
  ];
}

module.exports = { imageUpload, sniffImageType, MAX_BYTES };

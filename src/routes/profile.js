const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const { imageUpload } = require("../utils/upload");
const { verifyCsrfTokenParsed } = require("../middleware/csrf");

router.get("/", profileController.showProfile);
router.post("/", ...imageUpload("avatar"), verifyCsrfTokenParsed, profileController.updateProfile);
router.post("/password", profileController.changePassword);

module.exports = router;

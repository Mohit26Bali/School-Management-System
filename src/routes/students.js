const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const { imageUpload } = require("../utils/upload");
const { verifyCsrfTokenParsed } = require("../middleware/csrf");

router.get("/", studentController.list);
router.get("/add", studentController.showAdd);
router.post("/", ...imageUpload("image"), verifyCsrfTokenParsed, studentController.create);
router.get("/:id/edit", studentController.showEdit);
router.post("/:id", ...imageUpload("image"), verifyCsrfTokenParsed, studentController.update);
router.post("/:id/delete", studentController.remove);
router.post("/:id/reactivate", studentController.reactivate);
router.get("/:id", studentController.showDetails);

module.exports = router;

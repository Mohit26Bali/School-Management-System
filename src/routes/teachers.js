const express = require("express");
const router = express.Router();
const teacherController = require("../controllers/teacherController");
const { imageUpload } = require("../utils/upload");
const { verifyCsrfTokenParsed } = require("../middleware/csrf");

router.get("/", teacherController.list);
router.get("/add", teacherController.showAdd);
router.post("/", ...imageUpload("image"), verifyCsrfTokenParsed, teacherController.create);
router.get("/:id/edit", teacherController.showEdit);
router.post("/:id", ...imageUpload("image"), verifyCsrfTokenParsed, teacherController.update);
router.post("/:id/delete", teacherController.remove);
router.get("/:id", teacherController.showDetails);

module.exports = router;

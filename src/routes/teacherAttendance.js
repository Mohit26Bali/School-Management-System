const express = require("express");
const router = express.Router();
const teacherAttendanceController = require("../controllers/teacherAttendanceController");

router.get("/", teacherAttendanceController.showForm);
router.post("/", teacherAttendanceController.save);

module.exports = router;

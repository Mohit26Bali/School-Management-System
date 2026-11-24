const express = require("express");
const router = express.Router();
const studentAttendanceController = require("../controllers/studentAttendanceController");

router.get("/", studentAttendanceController.list);

module.exports = router;

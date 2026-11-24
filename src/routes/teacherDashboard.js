const express = require("express");
const router = express.Router();
const teacherDashboardController = require("../controllers/teacherDashboardController");

router.get("/", teacherDashboardController.showDashboard);

module.exports = router;

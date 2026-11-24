const express = require("express");
const router = express.Router();
const studentDashboardController = require("../controllers/studentDashboardController");

router.get("/", studentDashboardController.showDashboard);

module.exports = router;

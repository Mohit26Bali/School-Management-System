const express = require("express");
const router = express.Router();
const examResultsController = require("../controllers/examResultsController");

router.get("/", examResultsController.list);
router.get("/:examId", examResultsController.showSheet);
router.post("/:examId", examResultsController.saveSheet);

module.exports = router;

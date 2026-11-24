const express = require("express");
const router = express.Router();
const classController = require("../controllers/classController");

router.get("/", classController.list);
router.post("/:id/capacity", classController.updateCapacity);

module.exports = router;

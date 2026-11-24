const express = require("express");
const router = express.Router();
const timeTableController = require("../controllers/timeTableController");

router.get("/", timeTableController.list);
router.get("/add", timeTableController.showAdd);
router.post("/", timeTableController.create);
router.get("/:id/edit", timeTableController.showEdit);
router.post("/:id", timeTableController.update);
router.post("/:id/delete", timeTableController.remove);

module.exports = router;

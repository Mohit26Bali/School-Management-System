const express = require("express");
const router = express.Router();
const holidayController = require("../controllers/holidayController");

router.get("/", holidayController.list);
router.get("/add", holidayController.showAdd);
router.post("/", holidayController.create);
router.get("/:id/edit", holidayController.showEdit);
router.post("/:id", holidayController.update);
router.post("/:id/delete", holidayController.remove);

module.exports = router;

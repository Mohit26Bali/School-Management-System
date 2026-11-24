const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");

router.get("/", eventController.list);
router.get("/add", eventController.showAdd);
router.post("/", eventController.create);
router.get("/:id/edit", eventController.showEdit);
router.post("/:id", eventController.update);
router.post("/:id/delete", eventController.remove);

module.exports = router;

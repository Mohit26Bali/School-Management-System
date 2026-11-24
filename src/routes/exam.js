const express = require("express");
const router = express.Router();
const examController = require("../controllers/examController");

router.get("/", examController.list);
router.get("/add", examController.showAdd);
router.post("/", examController.create);
router.get("/:id/edit", examController.showEdit);
router.post("/:id", examController.update);
router.post("/:id/delete", examController.remove);

module.exports = router;

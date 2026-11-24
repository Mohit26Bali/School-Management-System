const express = require("express");
const router = express.Router();
const subjectController = require("../controllers/subjectController");

router.get("/", subjectController.list);
router.get("/add", subjectController.showAdd);
router.post("/", subjectController.create);
router.get("/:id/edit", subjectController.showEdit);
router.post("/:id", subjectController.update);
router.post("/:id/delete", subjectController.remove);

module.exports = router;

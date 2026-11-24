const express = require("express");
const router = express.Router();
const salaryController = require("../controllers/salaryController");

router.get("/", salaryController.list);
router.get("/add", salaryController.showAdd);
router.post("/", salaryController.create);
router.get("/:id/edit", salaryController.showEdit);
router.post("/:id", salaryController.update);
router.post("/:id/delete", salaryController.remove);

module.exports = router;

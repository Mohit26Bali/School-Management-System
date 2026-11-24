const express = require("express");
const router = express.Router();
const sportController = require("../controllers/sportController");

router.get("/", sportController.list);
router.get("/add", sportController.showAdd);
router.post("/", sportController.create);
router.get("/:id/edit", sportController.showEdit);
router.post("/:id", sportController.update);
router.post("/:id/delete", sportController.remove);

module.exports = router;

const express = require("express");
const router = express.Router();
const bookController = require("../controllers/bookController");

router.get("/", bookController.list);
router.get("/add", bookController.showAdd);
router.post("/", bookController.create);
router.get("/:id/edit", bookController.showEdit);
router.post("/:id", bookController.update);
router.post("/:id/delete", bookController.remove);

module.exports = router;

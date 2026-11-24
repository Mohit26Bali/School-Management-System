const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expenseController");

router.get("/", expenseController.list);
router.get("/add", expenseController.showAdd);
router.post("/", expenseController.create);
router.get("/:id/edit", expenseController.showEdit);
router.post("/:id", expenseController.update);
router.post("/:id/delete", expenseController.remove);

module.exports = router;

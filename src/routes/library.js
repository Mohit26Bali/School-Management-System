const express = require("express");
const router = express.Router();
const bookController = require("../controllers/bookController");
const loanController = require("../controllers/loanController");

router.get("/", bookController.list);
router.get("/add", bookController.showAdd);
router.get("/loans", loanController.list);
router.get("/loans/issue", loanController.showIssue);
router.post("/loans", loanController.issue);
router.post("/loans/:id/return", loanController.returnBook);
router.post("/", bookController.create);
router.get("/:id/edit", bookController.showEdit);
router.post("/:id", bookController.update);
router.post("/:id/delete", bookController.remove);

module.exports = router;

const express = require("express");
const router = express.Router();
const feeController = require("../controllers/feeController");

router.get("/", feeController.list);
router.get("/add", feeController.showAdd);
router.post("/", feeController.create);
router.get("/:id/edit", feeController.showEdit);
router.post("/:id", feeController.update);
router.post("/:id/delete", feeController.remove);

module.exports = router;

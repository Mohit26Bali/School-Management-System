const express = require("express");
const router = express.Router();
const transportController = require("../controllers/transportController");

router.get("/", transportController.list);
router.get("/add", transportController.showAdd);
router.post("/", transportController.create);
router.get("/:id/edit", transportController.showEdit);
router.post("/:id", transportController.update);
router.post("/:id/delete", transportController.remove);

module.exports = router;

const express = require("express");
const router = express.Router();
const hostelController = require("../controllers/hostelController");

router.get("/", hostelController.list);
router.get("/add", hostelController.showAdd);
router.post("/", hostelController.create);
router.get("/:id/edit", hostelController.showEdit);
router.post("/:id", hostelController.update);
router.post("/:id/delete", hostelController.remove);

module.exports = router;

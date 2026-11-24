const express = require("express");
const router = express.Router();
const departmentController = require("../controllers/departmentController");

router.get("/", departmentController.list);
router.get("/add", departmentController.showAdd);
router.post("/", departmentController.create);
router.get("/:id/edit", departmentController.showEdit);
router.post("/:id", departmentController.update);
router.post("/:id/delete", departmentController.remove);

module.exports = router;

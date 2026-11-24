const express = require("express");
const router = express.Router();
const transportController = require("../controllers/transportController");
const stay = require("../controllers/stayController");

router.get("/", transportController.list);
router.get("/add", transportController.showAdd);
router.get("/riders", stay.transportList);
router.get("/riders/assign", stay.transportForm);
router.post("/riders", stay.transportAssign);
router.post("/riders/:id/end", stay.transportEnd);
router.post("/", transportController.create);
router.get("/:id/edit", transportController.showEdit);
router.post("/:id", transportController.update);
router.post("/:id/delete", transportController.remove);

module.exports = router;

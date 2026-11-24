const express = require("express");
const router = express.Router();
const hostelController = require("../controllers/hostelController");
const stay = require("../controllers/stayController");

router.get("/", hostelController.list);
router.get("/add", hostelController.showAdd);
router.get("/allocations", stay.hostelList);
router.get("/allocations/allocate", stay.hostelForm);
router.post("/allocations", stay.hostelAllocate);
router.post("/allocations/:id/vacate", stay.hostelVacate);
router.post("/", hostelController.create);
router.get("/:id/edit", hostelController.showEdit);
router.post("/:id", hostelController.update);
router.post("/:id/delete", hostelController.remove);

module.exports = router;

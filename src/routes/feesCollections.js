const express = require("express");
const router = express.Router();
const feesCollectionController = require("../controllers/feesCollectionController");

router.get("/", feesCollectionController.list);
router.get("/add", feesCollectionController.showAdd);
router.post("/", feesCollectionController.create);
router.get("/:id/edit", feesCollectionController.showEdit);
router.get("/:id/invoice", feesCollectionController.showInvoice);
router.post("/:id", feesCollectionController.update);
router.post("/:id/delete", feesCollectionController.remove);

module.exports = router;

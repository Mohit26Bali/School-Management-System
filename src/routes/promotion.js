const express = require("express");
const router = express.Router();
const promotionController = require("../controllers/promotionController");

router.get("/", promotionController.show);
router.post("/", promotionController.promote);

module.exports = router;

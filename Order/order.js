const express = require("express");
const router = express.Router();
const { getPostion } = require("./getPosition.js");

router.post("/place-order", require("./placeorder"));
router.post("/exit-trade", require("./exitTrade.js"));
router.get("/order-book", require("./orderBook.js"));
router.get("/trade-book", require("./tradeBook.js"));
router.get("/get-position", getPostion);
router.post("/cancel-orders", require("./cancelOrders.js"));
router.post("/cancel-order", require("./cancelOrder.js"));
router.post("/strategy", require("./strategy.js"));

module.exports = router;

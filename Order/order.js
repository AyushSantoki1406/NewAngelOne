const express = require("express");
const router = express.Router();
const { getPostion, getPostionF } = require("./getPosition.js");

router.post("/place-order", require("./placeorder"));
router.post("/exit-trade", require("./exitTrade.js"));
router.get("/order-book", require("./orderBook.js"));
router.get("/trade-book", require("./tradeBook.js"));
router.get("/get-position", require("./getpostionWorking.js"));
router.post("/cancel-orders", require("./cancelOrders.js"));
router.post("/cancel-order", require("./cancelOrder.js"));
router.post("/strategy", require("./strategy.js"));
router.post("/profile", require("./getProfile.js"));
router.post("/robo-order", require("./roboOrder.js"));
router.post("/close-position", require("./closePostion.js"));
router.post("/stoploss-order", require("./stoplossOrder.js"));

module.exports = router;

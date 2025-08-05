const aoCredentials = require("../models/aoCredentials");
const header = require("../Header/header");
const { getTokens } = require("../config/tokenStore");

const roboOrder = async (req, res) => {
  try {
    const client_ids = req.body.client_ids;

    const credentials = await aoCredentials
      .find({ client_id: { $in: client_ids } })
      .lean();

    const missingClients = client_ids.filter(
      (id) => !credentials.find((cred) => cred.client_id === id)
    );

    if (missingClients.length > 0) {
      return res.status(400).json({
        status: "ERROR",
        message: `No credentials found for client IDs: ${missingClients.join(
          ", "
        )}`,
        errorcode: "MO8003",
      });
    }

    const orderPromises = credentials.map(async (cred) => {
      try {
        const jwtToken = process.env.JWT;

        // ✅ Cancel open orders if MARKET + closeOpenPostion is true
        if (
          req.body.ordertype === "MARKET" &&
          req.body.closeOpenPostion === true
        ) {
          const orderBookRes = await header(
            "get",
            "/secure/angelbroking/order/v1/getOrderBook",
            {},
            jwtToken,
            cred.apiKey
          );

          const orderData = orderBookRes?.data|| [];

          const activeOrders = orderData.filter((order) =>
            ["open"].includes(order.status.toLowerCase())
          );

          const cancelPromises = activeOrders.map((order) =>
            header(
              "post",
              "/secure/angelbroking/order/v1/cancelOrder",
              { variety: order.variety, orderid: order.orderid },
              jwtToken,
              cred.apiKey
            )
          );

          await Promise.all(cancelPromises); // Wait for all cancellations
        }

        // ✅ Prepare order data
        let data;
        if (req.body.ordertype === "MARKET") {
          data = {
            variety: req.body.variety,
            tradingsymbol: req.body.tradingsymbol,
            symboltoken: req.body.symboltoken,
            transactiontype: req.body.transactiontype,
            exchange: req.body.exchange,
            ordertype: req.body.ordertype,
            producttype: req.body.producttype,
            duration: "DAY",
            quantity: req.body.quantity,
            client_id: cred.client_id,
            stoploss: req.body.stoploss,
            squareoff: req.body.squareoff,
          };
        } else {
          data = {
            variety: req.body.variety,
            tradingsymbol: req.body.tradingsymbol,
            symboltoken: req.body.symboltoken,
            transactiontype: req.body.transactiontype,
            exchange: req.body.exchange,
            ordertype: req.body.ordertype,
            producttype: req.body.producttype,
            duration: "DAY",
            quantity: req.body.quantity,
            client_id: cred.client_id,
            stoploss: req.body.stoploss,
            squareoff: req.body.squareoff,
            price: req.body.price,
          };
        }

        // ✅ Place order
        const response = await header(
          "post",
          "/secure/angelbroking/order/v1/placeOrder",
          data,
          jwtToken,
          cred.apiKey
        );

        return {
          client_id: cred.client_id,
          success: true,
          response,
        };
      } catch (error) {
        return {
          client_id: cred.client_id,
          success: false,
          error: error.message || error,
        };
      }
    });

    const results = await Promise.all(orderPromises);

    res.status(200).json({
      status: "SUCCESS",
      results,
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Error in Order Place",
      error: error.message || error,
    });
  }
};

module.exports = roboOrder;

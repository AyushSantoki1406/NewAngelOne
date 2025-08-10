const aoCredentials = require("../models/aoCredentials");
const header = require("../Header/header");
const { getTokens } = require("../config/tokenStore");
const previousClose = require("../function/previousClose");

const stoplossOrder = async (req, res) => {
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

        if (closeOpenPostion === true) {
          const orderBookRes = await header(
            "get",
            "/secure/angelbroking/portfolio/v1/getAllHolding",
            {},
            cred.jwt
          );

          const orderData = orderBookRes?.data?.holdings || [];

          // Collect promises for previousClose calls
          const closePromises = orderData
            .filter(
              (item) =>
                item.tradingsymbol === tradingsymbol &&
                item.exchange === exchange &&
                item.quantity === quantity
            )
            .map((item) =>
              previousClose(
                "NORMAL",
                item.tradingsymbol,
                item.symboltoken,
                item.quantity > 0 ? "SELL" : "BUY",
                item.exchange,
                "MARKET",
                item.product,
                "DAY",
                item.quantity > 0 ? -item.quantity : Math.abs(item.quantity),
                cred.client_id,
                cred.jwt,
                cred.apiKey
              )
            );

          // Await all previousClose operations
          await Promise.all(closePromises);
        }

        // ✅ Build order data
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
            price: req.body.price,
            quantity: req.body.quantity,
            client_id: cred.client_id,
          };
        }

        // ✅ Place the stoploss order
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

module.exports = stoplossOrder;

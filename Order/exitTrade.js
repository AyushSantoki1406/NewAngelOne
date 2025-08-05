const aoCredentials = require("../models/aoCredentials");
const header = require("../Header/header");
const { getTokens } = require("../config/tokenStore");

const jwtToken = process.env.JWT;

const closeOrder = async (req, res) => {
  try {
    const { client_ids, tradingsymbol, transactiontype, producttype } =
      req.body;

    if (!tradingsymbol && !transactiontype && !producttype) {
      return res.status(400).json({
        status: "ERROR",
        message:
          "At least one of tradingsymbol, transactiontype, or producttype must be provided.",
        errorcode: "MO8004",
      });
    }

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

    const results = await Promise.all(
      credentials.map(async (cred) => {
        try {
          const orderBookRes = await header(
            "get",
            "/secure/angelbroking/order/v1/getOrderBook",
            {},
            jwtToken,
            cred.apiKey
          );

          const orderData = orderBookRes?.data || [];

          // Filter based on optional fields
          const filteredOrders = orderData.filter((order) => {
            return (
              (!tradingsymbol || order.tradingsymbol === tradingsymbol) &&
              (!transactiontype || order.transactiontype === transactiontype) &&
              (!producttype || order.producttype === producttype)
            );
          });

          const sortedOrders = filteredOrders.sort(
            (a, b) => new Date(a.updatetime) - new Date(b.updatetime)
          );

          const reverseOrders = await Promise.all(
            sortedOrders.map(async (order) => {
              const reverseType =
                order.transactiontype === "BUY" ? "SELL" : "BUY";

              const orderPayload = {
                variety: "NORMAL",
                tradingsymbol: order.tradingsymbol,
                symboltoken: order.symboltoken || "", // optional
                transactiontype: reverseType,
                exchange: order.exchange,
                ordertype: "MARKET",
                producttype: order.producttype,
                duration: "DAY",
                quantity: order.quantity,
                client_id: cred.client_id,
              };

              return header(
                "post",
                "/secure/angelbroking/order/v1/placeOrder",
                orderPayload,
                jwtToken,
                cred.apiKey
              )
                .then((response) => ({
                  original_orderid: order.orderid,
                  action: `${reverseType} placed`,
                  status: "SUCCESS",
                  placed_order_response: response.data,
                }))
                .catch((error) => ({
                  original_orderid: order.orderid,
                  action: `${reverseType} failed`,
                  status: "FAILED",
                  error: error.message || error,
                }));
            })
          );

          return {
            client_id: cred.client_id,
            reversed: reverseOrders,
          };
        } catch (error) {
          return { client_id: cred.client_id, error: error.message || error };
        }
      })
    );

    return res.status(200).json({
      status: "SUCCESS",
      data: results,
    });
  } catch (error) {
    console.error("Error in closeOrder:", error);
    return res
      .status(500)
      .json({
        status: "ERROR",
        message: "Internal server error",
        error: error.message,
      });
  }
};

module.exports = closeOrder;

const aoCredentials = require("../models/aoCredentials");
const header = require("../Header/header");
const { getTokens } = require("../config/tokenStore");

const jwtToken = process.env.JWT;

const cancelOrders = async (req, res) => {
  try {
    const { client_ids } = req.body;

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
          // Filter only orders that are NOT already cancelled or rejected
          const activeOrders = orderData.filter((order) =>
            ["open"].includes(order.status.toLowerCase())
          );
          console.log("activeOrders", activeOrders);

          // const cancelPromises = activeOrders.map((order) =>
          //   header(
          //     "post",
          //     "/secure/angelbroking/order/v1/cancelOrder",
          //     { variety: order.variety, orderid: order.orderid },
          //     jwtToken,
          //     cred.apiKey
          //   )
          //     .then((response) => ({
          //       orderid: order.orderid,
          //       tradingsymbol: order.tradingsymbol,
          //       status: "Cancelled",
          //       response: response.data,
          //     }))
          //     .catch((err) => ({
          //       orderid: order.orderid,
          //       tradingsymbol: order.tradingsymbol,
          //       status: "Failed",
          //       error: err.message || err,
          //     }))
          // );

          // const cancelResults = await Promise.all(cancelPromises);

          // return {
          //   client_id: cred.client_id,
          //   cancelled_orders: cancelResults,
          // };
        } catch (error) {
          return {
            client_id: cred.client_id,
            error: error.message || error,
          };
        }
      })
    );

    return res.status(200).json({
      status: "SUCCESS",
      data: results,
    });
  } catch (error) {
    console.error("Error in cancelOrders:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Failed to exit trade",
      details: error.message,
    });
  }
};

module.exports = cancelOrders;

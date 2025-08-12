const aoCredentials = require("../models/aoCredentials");
const header = require("../Header/header");
const { getTokens } = require("../config/tokenStore");
const previousClose = require("../function/previousClose");

const placeOrder = async (req, res) => {
  try {
    const {
      client_ids,
      variety,
      closeOpenPostion,
      symboltoken,
      tradingsymbol,
      exchange,
      quantity,
      transactiontype,
      ordertype,
      producttype,
      duration,
      price,
    } = req.body;

    console.log("Received order request:", req.body);

    const credentials = await aoCredentials
      .find({ client_id: { $in: client_ids } })
      .lean();

    const missingClients = client_ids.filter(
      (id) => !credentials.find((cred) => cred.client_id === id)
    );

    if (missingClients.length > 0) {
      console.log(
        `No credentials found for client IDs: ${missingClients.join(", ")}`
      );
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
        if (closeOpenPostion === true) {
          console.log(`Closing open positions for client: ${cred.client_id}`);
          const orderBookRes = await header(
            "get",
            "/secure/angelbroking/portfolio/v1/getAllHolding",
            {},
            cred.jwt
          );

          const orderData = orderBookRes?.data?.holdings || [];

          console.log("orderBookRes", orderBookRes?.data?.holdings);

          const closePromises = orderData.map((item) =>
            previousClose(
              "NORMAL",
              item.tradingsymbol,
              item.symboltoken,
              item.quantity > 0 ? "SELL" : "BUY",
              item.exchange,
              "MARKET",
              item.product,
              "DAY",
              Math.abs(item.quantity),
              cred.client_id,
              cred.jwt,
              cred.apiKey
            )
          );

          const respose = await Promise.all(closePromises);
          console.log(respose);

          console.log(`Closed open positions for client: ${cred.client_id}`);
        }

        // Construct order body
        let data;
        if (req.body.ordertype === "MARKET") {
          data = {
            variety,
            tradingsymbol,
            symboltoken,
            transactiontype,
            exchange,
            ordertype,
            producttype,
            duration,
            quantity,
            client_id: cred.client_id,
          };
        } else {
          data = {
            variety,
            tradingsymbol,
            symboltoken,
            transactiontype,
            exchange,
            ordertype,
            producttype,
            duration,
            price,
            quantity,
            client_id: cred.client_id,
          };
        }

        // Place the order
        const placeOrderResponse = await header(
          "post",
          "/secure/angelbroking/order/v1/placeOrder",
          data,
          cred.jwt,
          cred.apiKey
        );

        console.log(
          `Order placement attempt for client: ${cred.client_id}`,
          placeOrderResponse
        );

        // Check order status
        const orderId = placeOrderResponse?.data?.orderid;
        if (!orderId) {
          console.error(`No order ID returned for client: ${cred.client_id}`);
          return {
            client_id: cred.client_id,
            success: false,
            error: "No order ID returned from placeOrder",
          };
        }

        // Query order status
        const orderStatusResponse = await header(
          "get",
          "/secure/angelbroking/order/v1/getOrderBook",
          {},
          cred.jwt,
          cred.apiKey
        );

        const orderDetails = orderStatusResponse?.data?.find(
          (order) => order.orderid === orderId
        );

        if (!orderDetails) {
          console.error(
            `Order details not found for order ID: ${orderId}, client: ${cred.client_id}`
          );
          return {
            client_id: cred.client_id,
            success: false,
            error: "Order details not found in order book",
          };
        }

        const orderStatus = orderDetails.status; // e.g., "complete", "rejected", "open"
        if (orderStatus === "complete") {
          console.log(
            `Order executed successfully for client: ${cred.client_id}, order ID: ${orderId}`
          );
          return {
            client_id: cred.client_id,
            success: true,
            response: placeOrderResponse,
            status: "EXECUTED",
            orderDetails,
          };
        } else if (orderStatus === "rejected") {
          console.error(
            `Order rejected for client: ${
              cred.client_id
            }, order ID: ${orderId}, reason: ${orderDetails.text || "Unknown"}`
          );
          return {
            client_id: cred.client_id,
            success: false,
            error: `Order rejected: ${orderDetails.text || "Unknown"}`,
            status: "REJECTED",
            orderDetails,
          };
        } else {
          console.log(
            `Order status for client: ${cred.client_id}, order ID: ${orderId} is ${orderStatus}`
          );
          return {
            client_id: cred.client_id,
            success: true, // Consider it successful for now, as it’s not rejected
            response: placeOrderResponse,
            status: orderStatus.toUpperCase(),
            orderDetails,
          };
        }
      } catch (error) {
        console.error(
          `Failed to process order for client: ${cred.client_id}`,
          error.message || error
        );
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
    console.error("Error in order placement process:", error.message || error);
    res.status(500).json({
      status: "ERROR",
      message: "Error in Order Place",
      error: error.message || error,
    });
  }
};

module.exports = placeOrder;

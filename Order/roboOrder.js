const aoCredentials = require("../models/aoCredentials");
const header = require("../Header/header");
const { getTokens } = require("../config/tokenStore");
const previousClose = require("../function/previousClose");

const roboOrder = async (req, res) => {
  try {
    const {
      variety,
      tradingsymbol,
      symboltoken,
      transactiontype,
      exchange,
      ordertype,
      producttype,
      quantity,
      stoploss,
      squareoff,
      price,
      closeOpenPostion,
      client_ids,
    } = req.body;

    console.log("Received robo order request:", req.body);

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

          await Promise.all(closePromises);
          console.log(`Closed open positions for client: ${cred.client_id}`);
        }

        // Prepare order data
        let data;
        if (ordertype === "MARKET") {
          data = {
            variety,
            tradingsymbol,
            symboltoken,
            transactiontype,
            exchange,
            ordertype,
            producttype,
            duration: "DAY",
            quantity,
            client_id: cred.client_id,
            stoploss,
            squareoff,
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
            duration: "DAY",
            quantity,
            client_id: cred.client_id,
            stoploss,
            squareoff,
            price,
          };
        }

        // Place the robo order
        const placeOrderResponse = await header(
          "post",
          "/secure/angelbroking/order/v1/placeOrder",
          data,
          cred.jwt,
          cred.apiKey
        );

        console.log(
          `Robo order placement attempt for client: ${cred.client_id}`,
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
            `Robo order executed successfully for client: ${cred.client_id}, order ID: ${orderId}`
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
            `Robo order rejected for client: ${
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
            `Robo order status for client: ${cred.client_id}, order ID: ${orderId} is ${orderStatus}`
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
          `Failed to process robo order for client: ${cred.client_id}`,
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
    console.error(
      "Error in robo order placement process:",
      error.message || error
    );
    res.status(500).json({
      status: "ERROR",
      message: "Error in Robo Order Place",
      error: error.message || error,
    });
  }
};

module.exports = roboOrder;

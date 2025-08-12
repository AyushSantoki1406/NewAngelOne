const aoCredentials = require("../models/aoCredentials");
const header = require("../Header/header");
const { getTokens } = require("../config/tokenStore");

const cancelOrder = async (req, res) => {
  try {
    const {
      client_ids,
      tradingsymbol,
      transactiontype,
      producttype,
      exchange,
    } = req.body;

    console.log("Received cancel order request:", req.body);

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

    const results = await Promise.all(
      credentials.map(async (cred) => {
        try {
          console.log(`Fetching order book for client: ${cred.client_id}`);
          const orderBookRes = await header(
            "get",
            "/secure/angelbroking/order/v1/getOrderBook",
            {},
            cred.jwt,
            cred.apiKey
          );

          const orderData = orderBookRes?.data || [];
          console.log("orderBookRes?.data ", orderBookRes?.data);
          // Filter orders based on provided fields
          const filteredOrders = orderData
            .filter((order) => {
              return (
                (!tradingsymbol || order.tradingsymbol === tradingsymbol) &&
                (!transactiontype ||
                  order.transactiontype === transactiontype) &&
                (!producttype || order.producttype === producttype) &&
                (!exchange || order.exchange === exchange) &&
                order.status.toLowerCase() === "open"
              );
            })
            .sort((a, b) => new Date(a.updatetime) - new Date(b.updatetime));

          console.log(
            `Filtered open orders for client: ${cred.client_id}`,
            filteredOrders
          );

          if (filteredOrders.length === 0) {
            console.log(`No open orders found for client: ${cred.client_id}`);
            return {
              client_id: cred.client_id,
              cancelled_orders: [],
              message: "No open orders found matching criteria",
            };
          }

          // Cancel filtered orders
          const cancelPromises = filteredOrders.map(async (order) => {
            try {
              console.log(
                `Attempting to cancel order ID: ${order.orderid} for client: ${cred.client_id}`
              );
              const cancelResponse = await header(
                "post",
                "/secure/angelbroking/order/v1/cancelOrder",
                {
                  variety: order.variety == "AMO" ? "NORMAL" : order.variety,
                  orderid: order.orderid,
                },
                cred.jwt,
                cred.apiKey
              );

              console.log(
                `Cancel order response for order ID: ${order.orderid}, client: ${cred.client_id}`,
                cancelResponse
              );

              // Verify cancellation status
              const orderStatusResponse = await header(
                "get",
                "/secure/angelbroking/order/v1/getOrderBook",
                {},
                cred.jwt,
                cred.apiKey
              );

              const orderDetails = orderStatusResponse?.data?.find(
                (o) => o.orderid === order.orderid
              );

              if (!orderDetails) {
                console.error(
                  `Order details not found for order ID: ${order.orderid}, client: ${cred.client_id}`
                );
                return {
                  orderid: order.orderid,
                  tradingsymbol: order.tradingsymbol,
                  status: "FAILED",
                  error:
                    "Order details not found in order book after cancellation attempt",
                };
              }

              const orderStatus = orderDetails.status.toLowerCase();
              if (orderStatus === "cancelled") {
                console.log(
                  `Order ID: ${order.orderid} successfully cancelled for client: ${cred.client_id}`
                );
                return {
                  orderid: order.orderid,
                  tradingsymbol: order.tradingsymbol,
                  status: "CANCELLED",
                  response: cancelResponse.data,
                  orderDetails,
                };
              } else if (
                orderStatus === "rejected" ||
                orderStatus === "complete" ||
                orderStatus !== "cancelled"
              ) {
                console.error(
                  `Order cancellation failed for order ID: ${
                    order.orderid
                  }, client: ${
                    cred.client_id
                  }, status: ${orderStatus}, reason: ${
                    orderDetails.text || "Unknown"
                  }`
                );
                return {
                  orderid: order.orderid,
                  tradingsymbol: order.tradingsymbol,
                  status: "FAILED",
                  error: `Cancellation failed: ${
                    orderDetails.text || "Unknown"
                  }`,
                  orderDetails,
                };
              } else {
                console.log(
                  `Order ID: ${order.orderid} for client: ${cred.client_id} is still in status: ${orderStatus}`
                );
                return {
                  orderid: order.orderid,
                  tradingsymbol: order.tradingsymbol,
                  status: orderStatus.toUpperCase(),
                  response: cancelResponse.data,
                  orderDetails,
                };
              }
            } catch (err) {
              console.error(
                `Failed to cancel order ID: ${order.orderid} for client: ${cred.client_id}`,
                err.message || err
              );
              return {
                orderid: order.orderid,
                tradingsymbol: order.tradingsymbol,
                status: "FAILED",
                error: err.message || err,
              };
            }
          });

          const cancelResults = await Promise.all(cancelPromises);
          console.log(
            `Cancellation results for client: ${cred.client_id}`,
            cancelResults
          );

          return {
            client_id: cred.client_id,
            cancelled_orders: cancelResults,
          };
        } catch (error) {
          console.error(
            `Error processing orders for client: ${cred.client_id}`,
            error.message || error
          );
          return {
            client_id: cred.client_id,
            cancelled_orders: [],
            error: error.message || error,
          };
        }
      })
    );

    console.log("Final cancel order results:", results);
    return res.status(200).json({
      status: "SUCCESS",
      data: results,
    });
  } catch (error) {
    console.error("Error in cancelOrder process:", error.message || error);
    return res.status(500).json({
      status: "ERROR",
      message: "Failed to exit trade",
      details: error.message || error,
    });
  }
};

module.exports = cancelOrder;

const aoCredentials = require("../models/aoCredentials");
const header = require("../Header/header");

const closeAndPlace = async (req, res) => {
  try {
    const {
      client_ids,
      positionSize,
      tradingsymbol,
      symboltoken,
      transactiontype,
      exchange,
      producttype,
      quantity,
      duration,
    } = req.body;

    if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "client_ids must be a non-empty array.",
      });
    }

    const credentials = await aoCredentials
      .find({
        client_id: { $in: client_ids },
      })
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

    const allResults = [];

    await Promise.all(
      credentials.map(async (cred) => {
        const result = { client_id: cred.client_id, actions: [] };

        // ✅ Step 1: Close existing position if positionSize !== 0
        if (positionSize >= 1 || positionSize <= -1) {
          try {
            const orderBookRes = await header(
              "get",
              "/secure/angelbroking/portfolio/v1/getAllHolding",
              {},
              cred.jwt,
              cred.apiKey
            );

            const orderData = orderBookRes.data.holdings.flat() || [];

            const filteredOrders = orderData.filter((order) => {
              console.log("orderDataertfghujiol", orderData);
              console.log(
                "order.tradingsymbol == tradingsymbol",
                order.tradingsymbol == tradingsymbol
              );
              console.log(
                "order.producttype == producttype",
                order.producttype == producttype,
                order.product,
                producttype
              );
              return (
                (!tradingsymbol || order.tradingsymbol == tradingsymbol) &&
                (!producttype || order.product == producttype)
              );
            });

            console.log("filteredOrders", filteredOrders);

            const sortedOrders = filteredOrders.sort(
              (a, b) => new Date(a.updatetime) - new Date(b.updatetime)
            );

            const reverseOrders = await Promise.all(
              sortedOrders.map(async (order) => {
                const reverseType = "SELL";
                const reversePayload = {
                  variety: "NORMAL",
                  tradingsymbol: order.tradingsymbol,
                  symboltoken: order.symboltoken || "",
                  transactiontype: reverseType,
                  exchange: order.exchange,
                  ordertype: "MARKET",
                  producttype: order.producttype,
                  duration: "DAY",
                  quantity: order.quantity,
                  client_id: cred.client_id,
                };

                try {
                  const response = await header(
                    "post",
                    "/secure/angelbroking/order/v1/placeOrder",
                    reversePayload,
                    cred.jwt,
                    cred.apiKey
                  );
                  console.log("response", response);

                  return {
                    type: "exit",
                    orderid: order.orderid,
                    action: `${reverseType} placed`,
                    status: "SUCCESS",
                    response: response.data,
                  };
                } catch (error) {
                  return {
                    type: "exit",
                    orderid: order.orderid,
                    action: `${reverseType} failed`,
                    status: "FAILED",
                    error: error.message || error,
                  };
                }
              })
            );

            console.log("reverseOrders", reverseOrders);

            result.actions.push(...reverseOrders);
          } catch (err) {
            result.actions.push({
              type: "exit",
              status: "FAILED",
              error: err.message || err,
            });
          }
        }

        // ✅ Step 2: Place fresh market order
        try {
          const placePayload = {
            variety: "NORMAL",
            tradingsymbol,
            symboltoken,
            transactiontype,
            exchange,
            ordertype: "MARKET",
            producttype,
            duration,
            quantity,
            client_id: cred.client_id,
          };

          const placeRes = await header(
            "post",
            "/secure/angelbroking/order/v1/placeOrder",
            placePayload,
            cred.jwt,
            cred.apiKey
          );

          result.actions.push({
            type: "place",
            status: "SUCCESS",
            response: placeRes.data,
          });
        } catch (err) {
          result.actions.push({
            type: "place",
            status: "FAILED",
            error: err.message || err,
          });
        }

        allResults.push(result);
      })
    );

    return res.status(200).json({
      status: "SUCCESS",
      data: allResults,
    });
  } catch (error) {
    console.error("Error in closeAndPlace:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports = closeAndPlace;

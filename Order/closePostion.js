const header = require("../Header/header");
require("dotenv").config();
const aoCredentials = require("../models/aoCredentials");

const closePostion = async (req, res) => {
  try {
    const {
      client_ids,
      exchange,
      tradingsymbol,
      transactiontype,
      producttype,
    } = req.body;

    console.log("for close postion : ", req.body);
    const credentials = await aoCredentials
      .find({ client_id: { $in: client_ids } })
      .lean();

    const results = await Promise.all(
      credentials.map(async (cred) => {
        const sendData = await header(
          "get",
          "/secure/angelbroking/portfolio/v1/getAllHolding",
          {},
          cred.jwt
        );

        const flatResults = sendData.data.holdings.flat();

        const filtered = flatResults.filter((item) => {
          return (
            (!exchange || item.exchange === exchange) &&
            (!tradingsymbol || item.tradingsymbol === tradingsymbol) &&
            (!transactiontype || item.tradeSide === transactiontype) &&
            (!producttype || item.product === producttype)
          );
        });

        const orderResults = await Promise.all(
          filtered.map(async (item) => {
            const data = {
              variety: "NORMAL",
              tradingsymbol: item.tradingsymbol,
              symboltoken: item.symboltoken,
              transactiontype: item.quantity > 0 ? "SELL" : "BUY",
              exchange: item.exchange,
              ordertype: "MARKET",
              producttype: item.product,
              duration: "DAY",
              quantity: Math.abs(item.quantity),
              client_id: cred.client_id,
            };

            const response = await header(
              "post",
              "/secure/angelbroking/order/v1/placeOrder",
              data,
              cred.jwt,
              cred.apiKey
            );

            return {
              client_id: cred.client_id,
              success: true,
              response,
            };
          })
        );

        return orderResults;
      })
    );

    res.json({
      success: true,
      results: results.flat(),
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error in getpostion", error: error.message });
  }
};

module.exports = closePostion;

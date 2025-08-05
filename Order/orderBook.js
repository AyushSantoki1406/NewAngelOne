const header = require("../Header/header");

const { getTokens } = require("../config/tokenStore");
const jwtToken = process.env.JWT;

const orderBook = async (req, res) => {
  try {
    const sendData = await header(
      "get",
      "/secure/angelbroking/order/v1/getOrderBook",
      {},
      jwtToken
    );
    res.status(200).json(sendData);
  } catch (error) {
    res.json("Error in orderBook : ", error);
  }
};
module.exports = orderBook;

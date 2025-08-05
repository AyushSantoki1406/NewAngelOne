const header = require("../Header/header");
const { getTokens } = require("../config/tokenStore");
require("dotenv").config();
const jwtToken = process.env.JWT

const TradeBook = async (req, res) => {
  try {
    console.log(getTokens());
    const sendData = await header(
      "get",
      "/secure/angelbroking/order/v1/getTradeBook",
      {},
      jwtToken
    );
    res.status(200).json(sendData);
  } catch (error) {
    res.json("Error in tradeBook : ", error);
  }
};
module.exports = TradeBook;

const header = require("../Header/header");
const { getTokens } = require("../config/tokenStore");

const jwtToken = process.env.JWT;
require("dotenv").config();

const getPostion = async (req, res) => {
  try {
    const sendData = await header(
      "get",
      "/secure/angelbroking/order/v1/getPosition",
      {},
      jwtToken
    );
    // Filter out positions where buyqty == sellqty
    const filteredData = Array.isArray(sendData.data)
      ? sendData.data.filter((item) => item.buyqty !== item.sellqty)
      : [];

    return {
      ...sendData,
      data: filteredData,
    };
  } catch (error) {
    res.status(500).json({ message: "Error in getpostion", error });
  }
};

const getPostionF = async (data) => {
  try {
    const sendData = await header(
      "get",
      "/secure/angelbroking/order/v1/getPosition",
      {},
      jwtToken
    );
    console.log("sendata", sendData);

    const filteredData = Array.isArray(sendData.data)
      ? sendData.data.filter((item) => item.buyqty !== item.sellqty)
      : [];

    return {
      ...sendData,
      data: filteredData,
    };
  } catch (error) {
    return { message: "Error in getpostion", error };
  }
};

module.exports = { getPostion, getPostionF };

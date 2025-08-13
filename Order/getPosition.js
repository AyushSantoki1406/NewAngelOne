const header = require("../Header/header");
const { getTokens } = require("../config/tokenStore");
require("dotenv").config();
const aoCredentials = require("../models/aoCredentials");

const jwtToken = process.env.JWT;

const getPostion = async (req, res) => {
  try {
    const sendData = await header(
      "get",
      "/secure/angelbroking/order/v1/getPosition",
      {},
      jwtToken
    );
    console.log(sendData);
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

const getPostionF = async (req, res) => {
  try {
    const client_ids = req.body.client_ids;

    const credentials = await aoCredentials
      .find({ client_id: { $in: client_ids } })
      .lean();

    const orderPromises = credentials.map(async (cred) => {
      const sendData = await header(
        "get",
        "/secure/angelbroking/portfolio/v1/getAllHolding",
        {},
        cred.jwt,
        cred.apiKey
      );
      return sendData.data.holdings || [];
    });

    const results = await Promise.all(orderPromises);

    res.status(200).json({
      status: "SUCCESS",
      results,
    });
  } catch (error) {
    res.status(500).json({ message: "Error in getpostion", error });
  }
};

module.exports = { getPostion, getPostionF };

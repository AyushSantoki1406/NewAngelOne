const header = require("../Header/header");
const { getTokens } = require("../config/tokenStore");
require("dotenv").config();
const jwtToken = process.env.JWT

const getProfile = async (req, res) => {
  try {
    console.log(getTokens());
    const sendData = await header(
      "get",
      "/secure/angelbroking/user/v1/getRMS",
      {},
      jwtToken
    );
    res.status(200).json(sendData);
  } catch (error) {
    res.json("Error in getProfile : ", error);
  }
};
module.exports = getProfile;

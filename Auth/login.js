const header = require("../Header/header");
const speakeasy = require("speakeasy");
const tokenStore = require("../config/tokenStore"); // path to token store

const Login = async (req, res) => {
  try {
    const totpCode = speakeasy.totp({
      secret: req.body.secretKey,
      encoding: "base32",
    });

    const data = {
      clientcode: req.body.clientcode,
      password: req.body.password,
      totp: totpCode,
    };

    const sendData = await header(
      "post",
      "/auth/angelbroking/user/v1/loginByPassword",
      data
    );

    if (sendData?.data?.jwtToken) {
      tokenStore.setTokens({
        jwtToken: sendData.data.jwtToken,
        refreshToken: sendData.data.refreshToken,
        feedToken: sendData.data.feedToken,
      });
    }

    res.status(200).json(sendData);
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ error: "Login failed", details: error.message });
  }
};

module.exports = Login;
  
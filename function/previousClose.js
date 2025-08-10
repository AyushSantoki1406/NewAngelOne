const header = require("../Header/header");

const previousClose = async (
  variety,
  tradingsymbol,
  symboltoken,
  transactiontype,
  exchange,
  ordertype,
  producttype,
  duration,
  quantity,
  client_id,
  jwt,
  apiKey
) => {
  try {
    let data = {
      variety,
      tradingsymbol,
      symboltoken,
      transactiontype,
      exchange,
      ordertype,
      producttype,
      duration,
      quantity,
      client_id,
    };
    const response = await header(
      "post",
      "/secure/angelbroking/order/v1/placeOrder",
      data,
      jwt,
      apiKey
    );
    return {
      client_id: client_id,
      success: true,
      response,
    };
  } catch (error) {
    return {
      client_id: client_id,
      success: false,
      error: error.message || error,
    };
  }
};

module.exports = previousClose;

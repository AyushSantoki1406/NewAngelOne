var axios = require("axios");

const header = async (method, url, data, jwtToken, apikey) => {
  try {
    const config = {
      method: method,
      url: `${process.env.BASE_URL}${url}`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
        Accept: "application/json",
        "X-UserType": "USER",
        "X-SourceID": "WEB",
        "X-ClientLocalIP": "192.168.157.1",
        "X-ClientPublicIP": "106.193.147.98",
        "X-MACAddress": "fe80::87f:98ff:fe5a:f5cb",
        "X-PrivateKey": `${apikey}`,
      },
      data: data,
    };
    console.log(config);
    const response = await axios(config);

    return response.data;
  } catch (error) {
    console.error("Error in Header:", error.message);
    throw error;
  }
};

module.exports = header;

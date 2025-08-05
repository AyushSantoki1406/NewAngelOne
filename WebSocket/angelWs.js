const WebSocket = require("ws");
const { getTokens } = require("../config/tokenStore");

const runOrderStatusWS = () => {
  const jwtToken =getTokens().jwtToken;
  const clientCode = process.env.JWT;

  if (!jwtToken || !clientCode) {
    console.error("❌ Missing JWT token or client code");
    return;
  }

  const ws = new WebSocket("wss://tns.angelone.in/smart-order-update", {
    headers: {
      Authorization: `Bearer ${jwtToken}`,
    },
  });

  ws.on("open", () => {
    console.log("✅ WebSocket Order Status connection opened");
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      // console.log("📥 Order Update:", JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("❌ Error parsing message:", message);
    }
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket Error:", err.message);
  });

  ws.on("close", (code, reason) => {
    console.warn(`⚠️ WebSocket closed [${code}]: ${reason}`);
  });

  // 🔁 Optional ping every 10 seconds to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
      // console.log("📤 Sent ping");
    }
  }, 10000);

  ws.on("pong", () => {
    // console.log("📥 Received pong");
  });

  ws.on("close", () => {
    clearInterval(pingInterval);
  });
};

module.exports = runOrderStatusWS;

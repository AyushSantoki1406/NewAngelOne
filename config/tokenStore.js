let tokens = {
  jwtToken: null,
  refreshToken: null,
  feedToken: null,
};

module.exports = {
  getTokens: () => tokens,
  setTokens: (newTokens) => {
    console.log("📦 setTokens called with:", newTokens); // DEBUG
    tokens = { ...tokens, ...newTokens };
    console.log("✅ Updated tokens to:", tokens); // DEBUG
  },
};

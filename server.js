const express = require("express");
const app = express();
const cors = require("cors");
const auth = require("./Auth/auth");
const order = require("./Order/order");
require("dotenv").config();
const runWebSocket = require("./WebSocket/angelWs");
const getPostion = require("./Order/getPosition");
const mongoose = require("mongoose");

app.use(cors());
app.use(express.json());
const port = process.env.PORT;

mongoose
  .connect(`${process.env.MongoUrl}`)
  .then(() => {
    console.log("Mongoose Connected");
  })
  .catch((e) => {
    console.log("Error is " + e);
  });

app.get("/", (req, res) => res.send("Hello World!"));

app.use(auth);
app.use(order);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});

const express = require("express");
const db = require("./db");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Ade Wallet API is running 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on " + PORT));

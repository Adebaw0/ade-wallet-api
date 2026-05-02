const express = require("express");
const db = require("./db");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Ade Wallet API is running 🚀");
});

// Create user
app.post("/user", async (req, res) => {
  const { name, email } = req.body;

  const result = await db.query(
    "insert into users (name, email) values ($1, $2) returning *",
    [name, email]
  );

  res.json(result.rows[0]);
});

// Create wallet
app.post("/wallet", async (req, res) => {
  const { user_id } = req.body;

  const result = await db.query(
    "insert into wallets (user_id, balance, currency) values ($1, 0, 'NGN') returning *",
    [user_id]
  );

  res.json(result.rows[0]);
});

// Credit wallet
app.post("/credit", async (req, res) => {
  const { wallet_id, amount } = req.body;

  await db.query(
    "update wallets set balance = balance + $1 where id = $2",
    [amount, wallet_id]
  );

  await db.query(
    "insert into transactions (wallet_id, type, amount, description) values ($1, 'credit', $2, 'API credit')",
    [wallet_id, amount]
  );

  res.json({ message: "credited" });
});

// Transfer
app.post("/transfer", async (req, res) => {
  const { from, to, amount } = req.body;

  await db.query("update wallets set balance = balance - $1 where id = $2", [amount, from]);
  await db.query("update wallets set balance = balance + $1 where id = $2", [amount, to]);

  await db.query(
    "insert into transactions (wallet_id, type, amount, description) values ($1, 'debit', $2, 'transfer out')",
    [from, amount]
  );

  await db.query(
    "insert into transactions (wallet_id, type, amount, description) values ($1, 'credit', $2, 'transfer in')",
    [to, amount]
  );

  res.json({ message: "transfer complete" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on " + PORT));

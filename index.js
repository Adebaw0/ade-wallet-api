const express = require("express");
const db = require("./db");

const app = express();
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Ade Wallet API is running 🚀");
});

// ENV CHECK (IMPORTANT FOR DEBUGGING)
app.get("/env-check", (req, res) => {
  res.json({
    dbExists: !!process.env.DATABASE_URL
  });
});

// Create user
app.post("/user", async (req, res) => {
  try {
    const { name, email } = req.body;

    const result = await db.query(
      "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
      [name, email]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Create wallet
app.post("/wallet", async (req, res) => {
  try {
    const { user_id } = req.body;

    const result = await db.query(
      "INSERT INTO wallets (user_id, balance, currency) VALUES ($1, 0, 'NGN') RETURNING *",
      [user_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create wallet" });
  }
});

// Credit wallet
app.post("/credit", async (req, res) => {
  try {
    const { wallet_id, amount } = req.body;

    await db.query(
      "UPDATE wallets SET balance = balance + $1 WHERE id = $2",
      [amount, wallet_id]
    );

    await db.query(
      "INSERT INTO transactions (wallet_id, type, amount, description) VALUES ($1, 'credit', $2, 'API credit')",
      [wallet_id, amount]
    );

    res.json({ message: "credited" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to credit wallet" });
  }
});

// Transfer
app.post("/transfer", async (req, res) => {
  try {
    const { from, to, amount } = req.body;

    await db.query(
      "UPDATE wallets SET balance = balance - $1 WHERE id = $2",
      [amount, from]
    );

    await db.query(
      "UPDATE wallets SET balance = balance + $1 WHERE id = $2",
      [amount, to]
    );

    await db.query(
      "INSERT INTO transactions (wallet_id, type, amount, description) VALUES ($1, 'debit', $2, 'transfer out')",
      [from, amount]
    );

    await db.query(
      "INSERT INTO transactions (wallet_id, type, amount, description) VALUES ($1, 'credit', $2, 'transfer in')",
      [to, amount]
    );

    res.json({ message: "transfer complete" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Transfer failed" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

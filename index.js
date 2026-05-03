const express = require("express");
const db = require("./db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const SECRET = "secretkey";

// =======================
// HOME
// =======================
app.get("/", (req, res) => {
  res.send("Fintech API running 🚀");
});

// =======================
// REGISTER
// =======================
app.post("/register", async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const user = await db.query(
      "INSERT INTO users (name, phone, password) VALUES ($1,$2,$3) RETURNING id,name,phone",
      [name, phone, hashed]
    );

    res.json(user.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// LOGIN
// =======================
app.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await db.query(
      "SELECT * FROM users WHERE phone=$1",
      [phone]
    );

    if (user.rows.length === 0)
      return res.status(400).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.rows[0].password);

    if (!valid)
      return res.status(400).json({ error: "Wrong password" });

    const token = jwt.sign(
      { id: user.rows[0].id },
      SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// AUTH MIDDLEWARE
// =======================
function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader)
      return res.status(401).json({ error: "No token" });

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;

    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// =======================
// CREATE WALLET
// =======================
app.post("/wallet", auth, async (req, res) => {
  try {
    const wallet = await db.query(
      "INSERT INTO wallets (user_id, balance, currency) VALUES ($1,0,'NGN') RETURNING *",
      [req.user.id]
    );

    res.json(wallet.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// CREDIT WALLET
// =======================
app.post("/credit", auth, async (req, res) => {
  try {
    const { wallet_id, amount } = req.body;

    const wallet = await db.query(
      "SELECT * FROM wallets WHERE id=$1 AND user_id=$2",
      [wallet_id, req.user.id]
    );

    if (wallet.rows.length === 0)
      return res.status(403).json({ error: "Not your wallet" });

    const updated = await db.query(
      "UPDATE wallets SET balance = balance + $1 WHERE id=$2 RETURNING *",
      [amount, wallet_id]
    );

    await db.query(
      "INSERT INTO transactions (wallet_id, type, amount, description) VALUES ($1,'credit',$2,'Wallet funded')",
      [wallet_id, amount]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// SECURE TRANSFER
// =======================
app.post("/transfer", auth, async (req, res) => {
  try {
    const { to_wallet, amount } = req.body;

    // Get sender wallet (SECURE)
    const senderWallet = await db.query(
      "SELECT * FROM wallets WHERE user_id=$1",
      [req.user.id]
    );

    if (senderWallet.rows.length === 0)
      return res.status(404).json({ error: "Sender wallet not found" });

    const from_wallet = senderWallet.rows[0];

    // Get receiver wallet
    const receiverWallet = await db.query(
      "SELECT * FROM wallets WHERE id=$1",
      [to_wallet]
    );

    if (receiverWallet.rows.length === 0)
      return res.status(404).json({ error: "Receiver not found" });

    // Check balance
    if (Number(from_wallet.balance) < Number(amount))
      return res.status(400).json({ error: "Insufficient balance" });

    // Deduct sender
    await db.query(
      "UPDATE wallets SET balance = balance - $1 WHERE id=$2",
      [amount, from_wallet.id]
    );

    // Credit receiver
    await db.query(
      "UPDATE wallets SET balance = balance + $1 WHERE id=$2",
      [amount, to_wallet]
    );

    // Transactions
    await db.query(
      "INSERT INTO transactions (wallet_id, type, amount, description) VALUES ($1,'debit',$2,'Transfer sent')",
      [from_wallet.id, amount]
    );

    await db.query(
      "INSERT INTO transactions (wallet_id, type, amount, description) VALUES ($1,'credit',$2,'Transfer received')",
      [to_wallet, amount]
    );

    res.json({ message: "Transfer successful (secured)" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// BALANCE
// =======================
app.get("/balance/:wallet_id", auth, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM wallets WHERE id=$1 AND user_id=$2",
      [req.params.wallet_id, req.user.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Wallet not found" });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// TRANSACTIONS
// =======================
app.get("/transactions/:wallet_id", auth, async (req, res) => {
  try {
    const walletCheck = await db.query(
      "SELECT * FROM wallets WHERE id=$1 AND user_id=$2",
      [req.params.wallet_id, req.user.id]
    );

    if (walletCheck.rows.length === 0)
      return res.status(403).json({ error: "Not your wallet" });

    const result = await db.query(
      "SELECT * FROM transactions WHERE wallet_id=$1 ORDER BY created_at DESC",
      [req.params.wallet_id]
    );

    res.json({
      count: result.rows.length,
      transactions: result.rows
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

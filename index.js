const express = require("express");
const db = require("./db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Ade Wallet API is running 🚀");
});

// ENV check
app.get("/env-check", (req, res) => {
  res.json({
    dbExists: !!process.env.DATABASE_URL
  });
});

// =========================
// REGISTER (PHONE + PASSWORD)
// =========================
app.post("/register", async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      "INSERT INTO users (name, phone, password) VALUES ($1, $2, $3) RETURNING id, name, phone",
      [name, phone, hashedPassword]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// LOGIN
// =========================
app.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await db.query(
      "SELECT * FROM users WHERE phone = $1",
      [phone]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const valid = await bcrypt.compare(password, user.rows[0].password);

    if (!valid) {
      return res.status(400).json({ error: "Wrong password" });
    }

    const token = jwt.sign(
      { id: user.rows[0].id },
      "secretkey",
      { expiresIn: "1d" }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// AUTH MIDDLEWARE
// =========================
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const decoded = jwt.verify(token, "secretkey");
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// =========================
// CREATE WALLET (PROTECTED)
// =========================
app.post("/wallet", auth, async (req, res) => {
  try {
    const result = await db.query(
      "INSERT INTO wallets (user_id, balance, currency) VALUES ($1, 0, 'NGN') RETURNING *",
      [req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// CREDIT WALLET
// =========================
app.post("/credit", auth, async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// =========================
// TRANSFER
// =========================
app.post("/transfer", auth, async (req, res) => {
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

    res.json({ message: "transfer complete" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// SERVER START
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

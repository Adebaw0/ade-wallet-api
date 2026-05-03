const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("localhost")
    ? false
    : { rejectUnauthorized: false }
});

// Log connection attempt
pool.on("connect", () => {
  console.log("✅ Connected to database");
});

pool.on("error", (err) => {
  console.error("❌ DB error:", err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query("SELECT NOW()")
  .then(() => console.log("✅ Connected to database"))
  .catch(err => console.error("❌ DB error:", err.message));

module.exports = pool;

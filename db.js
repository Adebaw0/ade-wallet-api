const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test DB connection
(async () => {
  try {
    await pool.query("SELECT NOW()");
    console.log("✅ Connected to database");
  } catch (err) {
    console.error("❌ DB CONNECTION FAILED:", err.message);
  }
})();

module.exports = pool;

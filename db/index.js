// db/index.js
const { Pool } = require('pg');

// DATABASE_URL is provided by Supabase, e.g.:
// postgresql://postgres:[PASSWORD]@db.xxxxxxxx.supabase.co:5432/postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase
});

module.exports = pool;

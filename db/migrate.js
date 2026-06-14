// db/migrate.js
// Creates the Postgres schema for Dengue Watch LK and seeds starter data.
// Run with: npm run migrate
//
// PRIVACY: Reports are ANONYMOUS by design — no name, NIC, phone, or any
// personally-identifying field is ever stored.

require('dotenv').config();
const pool = require('./index');

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS district_stats (
      district    TEXT PRIMARY KEY,
      province    TEXT NOT NULL,
      cases       INTEGER NOT NULL DEFAULT 0,
      deaths      INTEGER NOT NULL DEFAULT 0,
      pct_of_max  REAL NOT NULL DEFAULT 0,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS province_stats (
      province    TEXT PRIMARY KEY,
      cases       INTEGER NOT NULL DEFAULT 0,
      deaths      INTEGER NOT NULL DEFAULT 0,
      severity    TEXT NOT NULL DEFAULT 'low',
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS reports (
      id            TEXT PRIMARY KEY,
      case_type     TEXT NOT NULL CHECK (case_type IN ('confirmed','suspected','death','cluster')),
      province      TEXT NOT NULL,
      district      TEXT NOT NULL,
      location      TEXT,
      onset_date    DATE,
      details       TEXT,
      status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','dismissed')),
      submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      reviewed_at   TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS daily_trend (
      date    DATE PRIMARY KEY,
      cases   INTEGER NOT NULL DEFAULT 0,
      deaths  INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
    CREATE INDEX IF NOT EXISTS idx_reports_district ON reports(district);
    CREATE INDEX IF NOT EXISTS idx_reports_submitted ON reports(submitted_at DESC);
  `);

  const districtSeed = [
    ['Colombo',    'Western',       8211, 26, 100],
    ['Gampaha',    'Western',       4872, 15, 59],
    ['Kandy',      'Central',       3641, 11, 44],
    ['Galle',      'Southern',      2890, 9,  35],
    ['Kalutara',   'Western',       2543, 8,  31],
    ['Ratnapura',  'Sabaragamuwa',  1988, 6,  24],
    ['Jaffna',     'Northern',      1329, 10, 16],
    ['Kurunegala', 'North Western', 1102, 3,  13],
  ];

  for (const [district, province, cases, deaths, pct] of districtSeed) {
    await pool.query(
      `INSERT INTO district_stats (district, province, cases, deaths, pct_of_max)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (district) DO UPDATE SET
         province = excluded.province, cases = excluded.cases,
         deaths = excluded.deaths, pct_of_max = excluded.pct_of_max,
         updated_at = now()`,
      [district, province, cases, deaths, pct]
    );
  }

  const provinceSeed = [
    ['Western',       9842, 31, 'critical'],
    ['Central',       4211, 14, 'high'],
    ['Southern',      3867, 11, 'high'],
    ['North Western', 2543, 8,  'medium'],
    ['North Central', 1987, 6,  'medium'],
    ['Sabaragamuwa',  1654, 5,  'medium-low'],
    ['Uva',           1432, 4,  'medium-low'],
    ['Eastern',       1876, 6,  'low'],
    ['Northern',      1329, 10, 'low'],
  ];

  for (const [province, cases, deaths, severity] of provinceSeed) {
    await pool.query(
      `INSERT INTO province_stats (province, cases, deaths, severity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (province) DO UPDATE SET
         cases = excluded.cases, deaths = excluded.deaths,
         severity = excluded.severity, updated_at = now()`,
      [province, cases, deaths, severity]
    );
  }

  console.log('Migration complete.');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

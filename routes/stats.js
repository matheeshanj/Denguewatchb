// routes/stats.js
const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/stats/summary
router.get('/summary', async (req, res, next) => {
  try {
    const totals = await pool.query(`
      SELECT COALESCE(SUM(cases),0) AS total_cases, COALESCE(SUM(deaths),0) AS total_deaths
      FROM district_stats
    `);
    const districtCount = await pool.query(`SELECT COUNT(*) AS n FROM district_stats`);
    const activeZones = await pool.query(`SELECT COUNT(*) AS n FROM district_stats WHERE cases > 0`);
    const reportCount = await pool.query(`SELECT COUNT(*) AS n FROM reports`);

    const today = new Date().toISOString().slice(0, 10);
    const todayRow = await pool.query(`SELECT cases, deaths FROM daily_trend WHERE date = $1`, [today]);

    res.json({
      totalCases: Number(totals.rows[0].total_cases),
      totalDeaths: Number(totals.rows[0].total_deaths),
      activeZones: Number(activeZones.rows[0].n),
      totalDistricts: Number(districtCount.rows[0].n),
      reportedBy: Number(reportCount.rows[0].n),
      deltas: {
        casesToday: todayRow.rows[0]?.cases || 0,
        deathsToday: todayRow.rows[0]?.deaths || 0,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/stats/districts
router.get('/districts', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT district AS name, province, cases, deaths, pct_of_max AS pct
      FROM district_stats
      ORDER BY cases DESC
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/stats/provinces
router.get('/provinces', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT province, cases, deaths, severity
      FROM province_stats
      ORDER BY cases DESC
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/stats/trend?days=14
router.get('/trend', async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days, 10) || 14, 90);
    const result = await pool.query(`
      SELECT date, cases, deaths FROM daily_trend
      ORDER BY date DESC LIMIT $1
    `, [days]);
    res.json(result.rows.reverse());
  } catch (err) { next(err); }
});

module.exports = router;

// routes/admin.js
//
// Health-authority endpoints for reviewing reports and updating stats.
// Protected by a shared-secret X-Admin-Token header (see server.js).

const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/admin/reports?status=pending
router.get('/reports', async (req, res, next) => {
  try {
    const status = req.query.status;
    let result;
    if (status && ['pending', 'verified', 'dismissed'].includes(status)) {
      result = await pool.query(`
        SELECT id, case_type AS "caseType", province, district, location,
               onset_date AS "onsetDate", details, status,
               submitted_at AS "submittedAt", reviewed_at AS "reviewedAt"
        FROM reports WHERE status = $1 ORDER BY submitted_at DESC
      `, [status]);
    } else {
      result = await pool.query(`
        SELECT id, case_type AS "caseType", province, district, location,
               onset_date AS "onsetDate", details, status,
               submitted_at AS "submittedAt", reviewed_at AS "reviewedAt"
        FROM reports ORDER BY submitted_at DESC
      `);
    }
    res.json(result.rows);
  } catch (err) { next(err); }
});

// PATCH /api/admin/reports/:id
// Body: { status: 'verified' | 'dismissed', applyToStats?: boolean }
router.patch('/reports/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { status, applyToStats } = req.body || {};
    if (!['verified', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: "status must be 'verified' or 'dismissed'." });
    }

    const reportResult = await client.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    const report = reportResult.rows[0];
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    await client.query('BEGIN');

    await client.query(
      `UPDATE reports SET status = $1, reviewed_at = now() WHERE id = $2`,
      [status, req.params.id]
    );

    if (status === 'verified' && applyToStats) {
      const isDeath = report.case_type === 'death';
      const caseInc = isDeath ? 0 : 1;
      const deathInc = isDeath ? 1 : 0;

      await client.query(`
        UPDATE district_stats SET cases = cases + $1, deaths = deaths + $2, updated_at = now()
        WHERE district = $3
      `, [caseInc, deathInc, report.district]);

      await client.query(`
        UPDATE province_stats SET cases = cases + $1, deaths = deaths + $2, updated_at = now()
        WHERE province = $3
      `, [caseInc, deathInc, report.province]);

      const today = new Date().toISOString().slice(0, 10);
      await client.query(`
        INSERT INTO daily_trend (date, cases, deaths) VALUES ($1, $2, $3)
        ON CONFLICT (date) DO UPDATE SET
          cases = daily_trend.cases + excluded.cases,
          deaths = daily_trend.deaths + excluded.deaths
      `, [today, caseInc, deathInc]);
    }

    await client.query('COMMIT');
    res.json({ id: req.params.id, status });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PUT /api/admin/district-stats/:district
// Body: { province, cases, deaths, pct }
router.put('/district-stats/:district', async (req, res, next) => {
  try {
    const { province, cases, deaths, pct } = req.body || {};
    if (typeof cases !== 'number' || typeof deaths !== 'number' || typeof pct !== 'number' || !province) {
      return res.status(400).json({ error: 'province, cases, deaths, and pct are required.' });
    }

    await pool.query(`
      INSERT INTO district_stats (district, province, cases, deaths, pct_of_max, updated_at)
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (district) DO UPDATE SET
        province = excluded.province,
        cases = excluded.cases,
        deaths = excluded.deaths,
        pct_of_max = excluded.pct_of_max,
        updated_at = now()
    `, [req.params.district, province, cases, deaths, pct]);

    res.json({ district: req.params.district, updated: true });
  } catch (err) { next(err); }
});

module.exports = router;

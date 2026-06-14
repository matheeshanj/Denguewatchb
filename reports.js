// routes/reports.js
//
// Anonymous citizen case reporting. No name, NIC, phone, email, or
// device identifier is ever accepted or stored.

const express = require('express');
const crypto = require('crypto');
const pool = require('../db');

const router = express.Router();

const VALID_CASE_TYPES = ['confirmed', 'suspected', 'death', 'cluster'];
const VALID_PROVINCES = [
  'Western', 'Central', 'Southern', 'Northern', 'Eastern',
  'North Western', 'North Central', 'Uva', 'Sabaragamuwa',
];

function generateTrackingId() {
  const year = new Date().getFullYear();
  const rand = crypto.randomInt(1000, 10000);
  return `DW-${year}-${rand}`;
}

// POST /api/reports
router.post('/', async (req, res, next) => {
  try {
    const { caseType, province, district, location, onsetDate, details } = req.body || {};

    if (!caseType || !VALID_CASE_TYPES.includes(caseType)) {
      return res.status(400).json({ error: 'Invalid or missing caseType.' });
    }
    if (!province || !VALID_PROVINCES.includes(province)) {
      return res.status(400).json({ error: 'Invalid or missing province.' });
    }
    if (!district || typeof district !== 'string' || district.length > 100) {
      return res.status(400).json({ error: 'Invalid or missing district.' });
    }
    if (location && (typeof location !== 'string' || location.length > 200)) {
      return res.status(400).json({ error: 'Location must be a string under 200 characters.' });
    }
    if (details && (typeof details !== 'string' || details.length > 2000)) {
      return res.status(400).json({ error: 'Details must be under 2000 characters.' });
    }
    if (onsetDate && !/^\d{4}-\d{2}-\d{2}$/.test(onsetDate)) {
      return res.status(400).json({ error: 'onsetDate must be in YYYY-MM-DD format.' });
    }

    let id, exists;
    do {
      id = generateTrackingId();
      exists = await pool.query('SELECT 1 FROM reports WHERE id = $1', [id]);
    } while (exists.rows.length > 0);

    await pool.query(`
      INSERT INTO reports (id, case_type, province, district, location, onset_date, details, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
    `, [id, caseType, province, district, location || null, onsetDate || null, details || null]);

    res.status(201).json({
      id,
      status: 'pending',
      message: 'Report received. Thank you for keeping Sri Lanka safe.',
    });
  } catch (err) { next(err); }
});

// GET /api/reports/recent?limit=12
router.get('/recent', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
    const result = await pool.query(`
      SELECT id, case_type AS "caseType", province, district, location, status,
             submitted_at AS "submittedAt"
      FROM reports ORDER BY submitted_at DESC LIMIT $1
    `, [limit]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

module.exports = router;

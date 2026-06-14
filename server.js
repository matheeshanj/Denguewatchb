// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const statsRoutes = require('./routes/stats');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*'
}));
app.use(express.json({ limit: '100kb' }));

// Rate limit report submissions instead of requiring identity.
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reports from this network. Please try again later.' },
});

app.use('/api/reports', (req, res, next) => {
  if (req.method === 'POST') return reportLimiter(req, res, next);
  next();
});

function requireAdmin(req, res, next) {
  const token = req.header('X-Admin-Token');
  if (!process.env.ADMIN_TOKEN) {
    return res.status(500).json({ error: 'ADMIN_TOKEN not configured on server.' });
  }
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

app.use('/api/stats', statsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', requireAdmin, adminRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Dengue Watch LK API running on port ${PORT}`);
});

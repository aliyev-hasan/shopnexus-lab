const express = require('express');
const router = express.Router();
const jwtConfig = require('../config/jwt');
const { sessionSecret } = require('../config/security');
const db = require('../config/db');
const Setting = require('../models/Setting');

// Diaqnostika endpoint-ləri
router.get('/config', async (req, res) => {
  const counts = {};
  for (const [name, store] of Object.entries(db)) {
    counts[name] = await new Promise(resolve => store.count({}, (err, n) => resolve(err ? -1 : n)));
  }
  res.json({
    node_env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    public_base_url: process.env.PUBLIC_BASE_URL || null,
    jwt_secret: jwtConfig.secret,
    jwt_expires_in: jwtConfig.expiresIn,
    session_secret: sessionSecret,
    database_files: Object.keys(db),
    record_counts: counts,
    uploads_dir: '/public/uploads'
  });
});

// Hazırkı tətbiq tənzimləmələri (komissiya, cashback, ödəniş simulyatoru).
router.get('/settings', async (req, res) => {
  const [commission, cashback, forceResult, delayMs] = await Promise.all([
    Setting.get('commission_rate', 0),
    Setting.get('cashback_percent', 3),
    Setting.get('payment_force_result', null),
    Setting.get('payment_delay_ms', 0)
  ]);
  res.json({
    commission_rate: commission,
    cashback_percent: cashback,
    payment_force_result: forceResult,
    payment_delay_ms: delayMs
  });
});

// Bütün NeDB kolleksiyalarının xam qeyd sayları (yük diaqnozu üçün).
router.get('/stats', async (req, res) => {
  const counts = {};
  for (const [name, store] of Object.entries(db)) {
    counts[name] = await new Promise(resolve => store.count({}, (err, n) => resolve(err ? -1 : n)));
  }
  res.json(counts);
});

module.exports = router;

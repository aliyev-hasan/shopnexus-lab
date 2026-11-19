const Setting = require('../models/Setting');

// Komissiya dərəcəsini oxu (faiz olaraq saxlanır, desimal qaytarır)
async function getCommissionRate() {
  const percent = Number(await Setting.get('commission_rate', 10)); // default 10%
  return percent / 100;
}

async function getCommissionPercent() {
  return Number(await Setting.get('commission_rate', 10));
}

module.exports = { getCommissionRate, getCommissionPercent };

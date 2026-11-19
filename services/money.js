function roundMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

function formatMoney(value) {
  return roundMoney(value).toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoney(value, { min = null, max = null } = {}) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (min !== null && number < min) return null;
  if (max !== null && number > max) return null;
  return roundMoney(number);
}

module.exports = { roundMoney, formatMoney, parseMoney };

const Setting = require('../models/Setting');

// Luhn alqoritmi: boşluqları sil, yalnız rəqəmləri yoxla
function luhnCheck(cardNumber) {
  if (typeof cardNumber !== 'string') return false;
  const digits = cardNumber.replace(/\s+/g, '');
  if (!/^\d+$/.test(digits)) return false;

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

// Kart tipini müəyyən et
function detectCardType(cardNumber) {
  const digits = String(cardNumber || '').replace(/\s+/g, '');
  if (!/^\d+$/.test(digits) || digits.length === 0) return 'Unknown';

  if (digits.startsWith('4')) return 'Visa';
  if (digits.startsWith('34') || digits.startsWith('37')) return 'Amex';

  if (/^5[1-5]/.test(digits)) return 'Mastercard';
  const firstFour = Number(digits.slice(0, 4));
  if (firstFour >= 2221 && firstFour <= 2720) return 'Mastercard';

  return 'Unknown';
}

// Deterministik kart simulyasiyası: son 4 rəqəmə görə nəticə
function simulateCardPayment(cardNumber) {
  const digits = String(cardNumber || '').replace(/\s+/g, '');
  const last4 = digits.slice(-4);

  const results = {
    '0001': 'SUCCESS',
    '0002': 'DECLINED',
    '0003': 'INSUFFICIENT_FUNDS',
    '0004': 'AUTH_REQUIRED',
    '0005': 'TIMEOUT'
  };

  return { result: results[last4] || 'SUCCESS' };
}

// Admin tərəfindən məcburi nəticə varsa onu qaytar
async function getForcedResult() {
  const value = await Setting.get('payment_force_result', null);
  return value || null;
}

// Simulyasiya gecikməsini oxu
async function getDelay() {
  const value = Number(await Setting.get('payment_delay_ms', 0));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

module.exports = { luhnCheck, detectCardType, simulateCardPayment, getForcedResult, getDelay };

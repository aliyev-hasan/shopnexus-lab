const SavedCard = require('../models/SavedCard');
const { luhnCheck, detectCardType, simulateCardPayment, getForcedResult } = require('./cardSimulator');

function validExpiry(value) {
  const match = String(value || '').trim().match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const expiryBoundary = new Date(year, month, 1);
  if (expiryBoundary <= new Date()) return null;
  return { month: match[1], year: String(year) };
}

async function authorizeSavedCard({ userId, cardId }) {
  const card = await SavedCard.findOwnedById(cardId, userId);
  if (!card) return { ok: false, result: 'INVALID_CARD', message: 'Seçilmiş kart tapılmadı.' };
  const result = await getForcedResult() || simulateCardPayment(`000000000000${card.last4}`).result;
  return { ok: result === 'SUCCESS', result, message: result === 'SUCCESS' ? null : 'Kart ödənişi rədd edildi.', brand: card.brand || 'Unknown', last4: card.last4, card };
}

async function authorizeNewCard({ cardNumber, expiry }) {
  const digits = String(cardNumber || '').replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19 || !luhnCheck(digits)) return { ok: false, result: 'INVALID_CARD', message: 'Kart nömrəsi düzgün deyil.' };
  const parsedExpiry = validExpiry(expiry);
  if (!parsedExpiry) return { ok: false, result: 'INVALID_EXPIRY', message: 'Kartın bitmə tarixi düzgün deyil.' };
  const result = await getForcedResult() || simulateCardPayment(digits).result;
  return { ok: result === 'SUCCESS', result, message: result === 'SUCCESS' ? null : 'Kart ödənişi rədd edildi.', brand: detectCardType(digits), last4: digits.slice(-4), expiry: parsedExpiry };
}

module.exports = { authorizeSavedCard, authorizeNewCard, validExpiry };

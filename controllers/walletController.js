const { randomUUID } = require('crypto');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const SavedCard = require('../models/SavedCard');
const Payment = require('../models/Payment');
const PaymentEvent = require('../models/PaymentEvent');
const Receipt = require('../models/Receipt');
const { authorizeSavedCard, authorizeNewCard } = require('../services/cardAuthorizationService');
const { createTopUpReceipt, createGiftCardReceipt } = require('../services/receiptService');
const { parseMoney, roundMoney, formatMoney } = require('../services/money');

const topUpLocks = new Map();

async function withTopUpLock(userId, work) {
  const previous = topUpLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  topUpLocks.set(userId, current);
  await previous;
  try { return await work(); } finally { release(); if (topUpLocks.get(userId) === current) topUpLocks.delete(userId); }
}

function ensureTopUpKey(req) {
  if (!req.session.walletTopUpKey) req.session.walletTopUpKey = randomUUID();
  return req.session.walletTopUpKey;
}

exports.getWallet = async (req, res) => {
  try {
    let wallet = await Wallet.findByUserId(req.user.id);
    if (!wallet) wallet = await Wallet.create(req.user.id, 0);
    const [transactions, savedCards, receipts] = await Promise.all([
      WalletTransaction.findByWalletId(wallet._id), SavedCard.findByUserId(req.user.id), Receipt.findByUserId(req.user.id)
    ]);
    res.render('wallet/index', { title: 'Cüzdanım', wallet, transactions, savedCards, receipts, topUpKey: ensureTopUpKey(req) });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/');
  }
};

exports.deleteSavedCard = async (req, res) => {
  try {
    const deleted = await SavedCard.delete(req.params.id, req.user.id);
    req.flash(deleted ? 'success' : 'error', deleted ? 'Kart silindi!' : 'Kart tapılmadı!');
    res.redirect('/wallet');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/wallet');
  }
};

exports.redeemGiftCard = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) { req.flash('error', 'Gift card kodu daxil edin!'); return res.redirect('/wallet'); }
    const giftCard = await GiftCard.findByCode(code);
    if (!giftCard || !giftCard.is_active) { req.flash('error', 'Gift card tapılmadı və ya artıq istifadə olunub!'); return res.redirect('/wallet'); }

    // Emitent balans yoxlaması simulyasiyası
    await new Promise(resolve => setTimeout(resolve, 800));

    let wallet = await Wallet.findByUserId(req.user.id);
    if (!wallet) wallet = await Wallet.create(req.user.id, 0);
    const newBalance = roundMoney(Number(wallet.balance) + Number(giftCard.balance));
    await Wallet.updateBalance(wallet._id, newBalance);
    await GiftCard.deactivate(giftCard._id);
    const giftCardTransaction = await GiftCardTransaction.create({ gift_card_id: giftCard._id, user_id: req.user.id, amount: giftCard.balance });
    const walletTransaction = await WalletTransaction.create({ wallet_id: wallet._id, type: 'TOP_UP', amount: giftCard.balance, balance_after: newBalance, description: 'Gift Card balansı' });
    const receipt = await createGiftCardReceipt({ userId: req.user.id, giftCardTransaction, walletTransaction, amount: giftCard.balance });
    req.flash('success', `${formatMoney(giftCard.balance)} ₼ gift card cüzdana əlavə edildi!`);
    res.redirect(`/receipts/${receipt.public_token}`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/wallet');
  }
};

exports.topUp = async (req, res) => withTopUpLock(req.user.id, async () => {
  try {
    const amount = parseMoney(req.body.amount, { min: 0.01, max: 10000 });
    if (amount === null) {
      req.flash('error', 'Məbləğ 0.01 ₼ ilə 10,000 ₼ arasında olmalıdır.');
      return res.redirect('/wallet');
    }

    const idempotencyKey = String(req.body.idempotency_key || '');
    const existingPayment = await Payment.findByIdempotencyKey(idempotencyKey);
    if (existingPayment) {
      const receipt = await Receipt.findByOperationKey(`WALLET_TOP_UP:${existingPayment._id}`);
      req.flash(existingPayment.status === 'CAPTURED' ? 'success' : 'error', existingPayment.status === 'CAPTURED' ? 'Bu balans artırma artıq tamamlanıb.' : 'Bu ödəniş sorğusu artıq emal olunub.');
      return res.redirect(receipt ? `/receipts/${receipt.public_token}` : '/wallet');
    }
    if (!idempotencyKey || idempotencyKey !== req.session.walletTopUpKey) {
      req.flash('error', 'Balans artırma forması etibarsızdır. Səhifəni yeniləyin.');
      return res.redirect('/wallet');
    }

    const cardSource = String(req.body.card_source || 'new');

    // Yeni kartla doldurma zamanı CVV tələb olunur; CVV saxlanılmır,
    // saxlanmış kart seçilərsə tələb olunmur.
    if (cardSource === 'new') {
      const cvv = String(req.body.card_cvv || '').trim();
      if (!/^\d{3,4}$/.test(cvv)) {
        req.flash('error', 'Yeni kartla əlavə etmə üçün CVV daxil edilməlidir!');
        return res.redirect('/wallet');
      }
    }

    const authorization = cardSource === 'new'
      ? await authorizeNewCard({ cardNumber: req.body.card_number, expiry: req.body.card_expiry })
      : await authorizeSavedCard({ userId: req.user.id, cardId: cardSource });

    const payment = await Payment.create({
      user_id: req.user.id, method: 'CARD_SIMULATOR', amount,
      status: authorization.ok ? 'AUTHORIZED' : 'DECLINED', operation_type: 'WALLET_TOP_UP',
      idempotency_key: idempotencyKey, card_brand: authorization.brand || null, card_last4: authorization.last4 || null
    });
    await PaymentEvent.create(payment._id, authorization.ok ? 'AUTHORIZED' : authorization.result || 'DECLINED');
    req.session.walletTopUpKey = randomUUID();

    if (!authorization.ok) {
      req.flash('error', authorization.message || 'Kart ödənişi uğursuz oldu.');
      return res.redirect('/wallet');
    }

    let wallet = await Wallet.findByUserId(req.user.id);
    if (!wallet) wallet = await Wallet.create(req.user.id, 0);
    const newBalance = roundMoney(Number(wallet.balance) + amount);
    await Wallet.updateBalance(wallet._id, newBalance);
    const transaction = await WalletTransaction.create({ wallet_id: wallet._id, type: 'TOP_UP', amount, balance_after: newBalance, related_payment_id: payment._id, description: `Kart •••• ${authorization.last4}` });
    const captured = await Payment.transition(payment._id, ['AUTHORIZED'], 'CAPTURED');
    if (!captured) throw new Error('Ödəniş təsdiqlənə bilmədi.');
    await PaymentEvent.create(payment._id, 'CAPTURED');

    if (cardSource === 'new' && ['on', 'true', '1'].includes(String(req.body.save_card || ''))) {
      await SavedCard.create({ user_id: req.user.id, last4: authorization.last4, brand: String(authorization.brand || 'card').toLowerCase(), exp_month: authorization.expiry.month, exp_year: authorization.expiry.year });
    }

    const receipt = await createTopUpReceipt({ userId: req.user.id, payment: captured, transaction });
    req.flash('success', `Cüzdana ${formatMoney(amount)} ₼ əlavə edildi!`);
    res.redirect(`/receipts/${receipt.public_token}`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/wallet');
  }
});

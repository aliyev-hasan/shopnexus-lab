const Setting = require('../models/Setting');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const Order = require('../models/Order');
const { roundMoney } = require('./money');

// Cashback hesabla və wallet-ə əlavə et (idempotent)
async function grantCashback(orderId) {
  const order = await Order.findById(orderId);
  if (!order) return { granted: false, reason: 'Order not found' };
  if (order.cashback_granted) return { granted: false, reason: 'already_granted' };

  const cashbackPercent = Number(await Setting.get('cashback_percent', 3));
  const cashback = roundMoney(Number(order.total_amount) * cashbackPercent / 100);
  if (cashback <= 0) return { granted: false, reason: 'zero' };

  let wallet = await Wallet.findByUserId(order.user_id);
  if (!wallet) {
    wallet = await Wallet.create(order.user_id, 0);
  }

  const newBalance = roundMoney(Number(wallet.balance) + cashback);
  await Wallet.updateBalance(wallet._id, newBalance);
  await WalletTransaction.create({
    wallet_id: wallet._id,
    type: 'CASHBACK',
    amount: cashback,
    balance_after: newBalance,
    related_payment_id: null,
    status: 'AVAILABLE'
  });
  await Order.markCashbackGranted(orderId, cashback);
  return { granted: true, amount: cashback, walletId: wallet._id };
}

// Cashback-i geri al (refund zamanı)
async function reverseCashback(orderId) {
  const order = await Order.findById(orderId);
  if (!order || !order.cashback_granted) return { reversed: false };

  // Snapshot məbləği varsa onu istifadə et (grant anındakı dəyər); yoxdursa fallback cari faiz
  let cashback = Number(order.cashback_amount);
  if (!Number.isFinite(cashback) || cashback <= 0) {
    const cashbackPercent = Number(await Setting.get('cashback_percent', 3));
    cashback = roundMoney(Number(order.total_amount) * cashbackPercent / 100);
  }

  let wallet = await Wallet.findByUserId(order.user_id);
  if (!wallet) {
    return { reversed: false };
  }

  const newBalance = roundMoney(Number(wallet.balance) - cashback);
  await Wallet.updateBalance(wallet._id, newBalance);
  await WalletTransaction.create({
    wallet_id: wallet._id,
    type: 'CASHBACK_REVERSAL',
    amount: cashback,
    balance_after: newBalance,
    related_payment_id: null,
    status: 'AVAILABLE'
  });
  await Order.setCashbackGranted(orderId, false);
  return { reversed: true, amount: cashback };
}

module.exports = { grantCashback, reverseCashback };

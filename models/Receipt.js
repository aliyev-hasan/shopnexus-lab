const { receiptsDb } = require('../config/db');
const { randomBytes, randomUUID } = require('crypto');
const { roundMoney } = require('../services/money');
let indexPromise = null;

function ensureIndexes() {
  if (!indexPromise) indexPromise = Promise.all([
    new Promise((resolve, reject) => receiptsDb.ensureIndex({ fieldName: 'public_token', unique: true }, error => error ? reject(error) : resolve())),
    new Promise((resolve, reject) => receiptsDb.ensureIndex({ fieldName: 'operation_key', unique: true }, error => error ? reject(error) : resolve()))
  ]);
  return indexPromise;
}

class Receipt {
  static async create(data) {
    await ensureIndexes();
    if (!data.user_id || !data.operation_type || !data.operation_key) throw new Error('Qəbz əməliyyat məlumatları natamamdır.');
    const existing = await Receipt.findByOperationKey(data.operation_key);
    if (existing) return existing;
    const now = new Date().toISOString();
    const referenceDate = now.slice(0, 10).replace(/-/g, '');
    const doc = {
      _id: randomUUID(),
      public_token: randomBytes(32).toString('hex'),
      reference_number: `SNX-${referenceDate}-${randomBytes(5).toString('hex').toUpperCase()}`,
      operation_type: data.operation_type,
      operation_key: data.operation_key,
      transaction_id: data.transaction_id || null,
      payment_ids: Array.isArray(data.payment_ids) ? data.payment_ids : [],
      order_id: data.order_id || null,
      refund_id: data.refund_id || null,
      user_id: data.user_id,
      customer_name: data.customer_name || null,
      merchant_names: Array.isArray(data.merchant_names) ? data.merchant_names : [],
      payment_method: data.payment_method || null,
      amount: roundMoney(data.amount),
      currency: data.currency || 'AZN',
      status: data.status || 'COMPLETED',
      card_brand: data.card_brand || null,
      card_last4: data.card_last4 ? String(data.card_last4).slice(-4) : null,
      wallet_contribution: roundMoney(data.wallet_contribution),
      card_contribution: roundMoney(data.card_contribution),
      subtotal: roundMoney(data.subtotal),
      discount: roundMoney(data.discount),
      final_total: roundMoney(data.final_total == null ? data.amount : data.final_total),
      refund_amount: roundMoney(data.refund_amount),
      refund_reason: data.refund_reason || null,
      items: Array.isArray(data.items) ? data.items.map(item => ({ name: String(item.name || ''), quantity: Number(item.quantity) || 0, unit_price: roundMoney(item.unit_price), line_total: roundMoney(item.line_total) })) : [],
      created_at: data.created_at || now
    };
    return new Promise((resolve, reject) => receiptsDb.insert(doc, (err, saved) => {
      if (!err) return resolve(saved);
      if (err.errorType !== 'uniqueViolated') return reject(err);
      receiptsDb.findOne({ operation_key: data.operation_key }, (findError, existingReceipt) => findError ? reject(findError) : existingReceipt ? resolve(existingReceipt) : reject(err));
    }));
  }

  static async findByPublicToken(token) {
    return new Promise((resolve, reject) => receiptsDb.findOne({ public_token: String(token || '') }, (err, doc) => err ? reject(err) : resolve(doc)));
  }

  static async findByOperationKey(key) {
    return new Promise((resolve, reject) => receiptsDb.findOne({ operation_key: key }, (err, doc) => err ? reject(err) : resolve(doc)));
  }

  static async findByUserId(userId) {
    return new Promise((resolve, reject) => receiptsDb.find({ user_id: userId }).sort({ created_at: -1 }).exec((err, docs) => err ? reject(err) : resolve(docs)));
  }
}

module.exports = Receipt;

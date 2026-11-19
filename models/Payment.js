const { paymentsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');
const { roundMoney } = require('../services/money');
let idempotencyIndexPromise = null;

class Payment {
  // Yeni ödəniş yarat (status default: CREATED)
  static async create(data) {
    if (data.idempotency_key) {
      if (!idempotencyIndexPromise) idempotencyIndexPromise = new Promise((resolve, reject) => paymentsDb.ensureIndex({ fieldName: 'idempotency_key', unique: true, sparse: true }, err => err ? reject(err) : resolve()));
      await idempotencyIndexPromise;
    }
    const newPayment = {
      _id: uuidv4(),
      order_id: data.order_id || null,
      user_id: data.user_id,
      method: data.method,
      amount: roundMoney(data.amount),
      status: data.status || 'CREATED',
      operation_type: data.operation_type || (data.order_id ? 'ORDER_PAYMENT' : null),
      idempotency_key: data.idempotency_key || undefined,
      card_brand: data.card_brand || null,
      card_last4: data.card_last4 ? String(data.card_last4).slice(-4) : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      paymentsDb.insert(newPayment, (err, doc) => {
        if (err) return reject(err.errorType === 'uniqueViolated' ? new Error('Bu ödəniş sorğusu artıq emal olunub.') : err);
        resolve(doc);
      });
    });
  }

  // Ödənişi ID ilə tap
  static async findById(id) {
    return new Promise((resolve, reject) => {
      paymentsDb.findOne({ _id: id }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Sifarişə aid bütün ödənişləri tap (split payment üçün)
  static async findAllByOrderId(orderId) {
    return new Promise((resolve, reject) => {
      paymentsDb.find({ order_id: orderId }, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // İstifadəçiyə aid ödənişləri tap
  static async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      paymentsDb.find({ user_id: userId }, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  static async findByIdempotencyKey(key) {
    if (!key) return null;
    return new Promise((resolve, reject) => paymentsDb.findOne({ idempotency_key: key }, (err, doc) => err ? reject(err) : resolve(doc)));
  }

  // Bütün ödənişləri göstər
  static async findAll() {
    return new Promise((resolve, reject) => {
      paymentsDb.find({}, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Ödəniş statusunu yenilə (updated_at ilə birlikdə)
  static async updateStatus(paymentId, status) {
    return new Promise((resolve, reject) => {
      paymentsDb.update({ _id: paymentId }, { $set: { status, updated_at: new Date().toISOString() } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        if (numUpdated !== 1) return resolve(false);
        paymentsDb.findOne({ _id: paymentId }, (err, doc) => {
          if (err) return reject(err);
          resolve(doc);
        });
      });
    });
  }

  // Yalnız qanuni status keçidini icra et; qeyri-qanuni keçiddə false qaytar
  static async transition(paymentId, fromStatuses, toStatus) {
    const payment = await Payment.findById(paymentId);
    if (!payment) return false;
    if (!Array.isArray(fromStatuses) || !fromStatuses.includes(payment.status)) return false;
    return Payment.updateStatus(paymentId, toStatus);
  }
}

module.exports = Payment;

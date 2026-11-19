const { refundsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');
const { roundMoney } = require('../services/money');

class Refund {
  static async create({ order_id, user_id, amount, reason, status }) {
    const newRefund = {
      _id: uuidv4(),
      order_id,
      user_id,
      amount: roundMoney(amount),
      reason: reason || null,
      status: status || 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      refundsDb.insert(newRefund, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  static async findAll() {
    return new Promise((resolve, reject) => {
      refundsDb.find({}, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      refundsDb.findOne({ _id: id }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  static async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      refundsDb.find({ user_id: userId }).sort({ created_at: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  static async findByOrderId(orderId) {
    return new Promise((resolve, reject) => {
      refundsDb.find({ order_id: orderId }, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  static async updateStatus(id, status) {
    return new Promise((resolve, reject) => {
      refundsDb.update({ _id: id }, { $set: { status, updated_at: new Date().toISOString() } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        if (numUpdated !== 1) return resolve(false);
        refundsDb.findOne({ _id: id }, (err, doc) => {
          if (err) return reject(err);
          resolve(doc);
        });
      });
    });
  }
}

module.exports = Refund;

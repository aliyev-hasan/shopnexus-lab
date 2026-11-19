const { giftCardTransactionsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');

class GiftCardTransaction {
  static async create({ gift_card_id, user_id, amount }) {
    const newTransaction = {
      _id: uuidv4(),
      gift_card_id,
      user_id,
      amount: Number(amount) || 0,
      created_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      giftCardTransactionsDb.insert(newTransaction, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  static async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      giftCardTransactionsDb.find({ user_id: userId }).sort({ created_at: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }
}

module.exports = GiftCardTransaction;

const { walletTransactionsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');
const { roundMoney } = require('../services/money');

class WalletTransaction {
  // Yalnız insert (immutable ledger qeydi)
  static async create(data) {
    const newTransaction = {
      _id: uuidv4(),
      wallet_id: data.wallet_id,
      type: data.type,
      amount: roundMoney(data.amount),
      balance_after: roundMoney(data.balance_after),
      related_payment_id: data.related_payment_id || null,
      status: data.status || 'AVAILABLE',
      description: data.description || null,
      created_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      walletTransactionsDb.insert(newTransaction, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Bütün əməliyyatları göstər
  static async findAll() {
    return new Promise((resolve, reject) => {
      walletTransactionsDb.find({}, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Cüzdana aid əməliyyatları tarixə görə sırala (yenidən köhnəyə)
  static async findByWalletId(walletId) {
    return new Promise((resolve, reject) => {
      walletTransactionsDb.find({ wallet_id: walletId }).sort({ created_at: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }
}

module.exports = WalletTransaction;

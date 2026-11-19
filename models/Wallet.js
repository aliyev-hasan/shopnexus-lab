const { walletsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');
const { roundMoney } = require('../services/money');

class Wallet {
  // Yeni cüzdan yarat
  static async create(userId, initialBalance = 0) {
    const newWallet = {
      _id: uuidv4(),
      user_id: userId,
      balance: roundMoney(initialBalance),
      updated_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      walletsDb.insert(newWallet, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // İstifadəçiyə aid cüzdanı tap
  static async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      walletsDb.findOne({ user_id: userId }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Bütün cüzdanları göstər
  static async findAll() {
    return new Promise((resolve, reject) => {
      walletsDb.find({}, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Cüzdan balansını yenilə
  static async updateBalance(walletId, newBalance) {
    return new Promise((resolve, reject) => {
      walletsDb.update({ _id: walletId }, { $set: { balance: roundMoney(newBalance), updated_at: new Date().toISOString() } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        if (numUpdated !== 1) return resolve(false);
        walletsDb.findOne({ _id: walletId }, (err, doc) => {
          if (err) return reject(err);
          resolve(doc);
        });
      });
    });
  }
}

module.exports = Wallet;

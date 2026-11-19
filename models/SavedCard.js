const { savedCardsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');

class SavedCard {
  // PCI təhlükəsizliyi: CVV (hətta hash şəklində) SavedCard sənədinə yazılmır.
  static async create({ user_id, last4, brand, exp_month, exp_year }) {
    const newCard = {
      _id: uuidv4(),
      token: uuidv4(),
      user_id,
      last4: String(last4 || '').replace(/\D/g, '').slice(-4),
      brand: brand || 'visa',
      exp_month: exp_month || null,
      exp_year: exp_year || null,
      created_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      savedCardsDb.insert(newCard, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  static async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      savedCardsDb.find({ user_id: userId }).sort({ created_at: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      savedCardsDb.findOne({ _id: id }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Ownership yoxlaması ilə birgə kartı tap (istifadəçi yalnız öz kartını istifadə edə bilər)
  static async findOwnedById(id, userId) {
    return new Promise((resolve, reject) => {
      savedCardsDb.findOne({ _id: id, user_id: userId }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  static async delete(id, userId) {
    return new Promise((resolve, reject) => {
      savedCardsDb.remove({ _id: id, user_id: userId }, {}, (err, numRemoved) => {
        if (err) return reject(err);
        resolve(numRemoved === 1);
      });
    });
  }
}

module.exports = SavedCard;

const { giftCardsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');
const { roundMoney } = require('../services/money');

// Kod seqmenti generasiya et: 4 böyük hərf/rəqəm
function generateSegment() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let segment = '';
  for (let i = 0; i < 4; i++) {
    segment += chars[Math.floor(Math.random() * chars.length)];
  }
  return segment;
}

class GiftCard {
  // Yeni gift card yarat
  static async create(balance) {
    const newGiftCard = {
      _id: uuidv4(),
      code: `SHOP-${generateSegment()}-${generateSegment()}`,
      balance: roundMoney(balance),
      is_active: true,
      expires_at: null,
      created_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      giftCardsDb.insert(newGiftCard, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Kodu ilə tap
  static async findByCode(code) {
    return new Promise((resolve, reject) => {
      giftCardsDb.findOne({ code: String(code).trim() }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Bütün gift card-ları göstər
  static async findAll() {
    return new Promise((resolve, reject) => {
      giftCardsDb.find({}, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Deaktiv et
  static async deactivate(id) {
    return new Promise((resolve, reject) => {
      giftCardsDb.update({ _id: id }, { $set: { is_active: false } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        if (numUpdated !== 1) return resolve(false);
        giftCardsDb.findOne({ _id: id }, (err, doc) => {
          if (err) return reject(err);
          resolve(doc);
        });
      });
    });
  }

  // Sil
  static async delete(id) {
    return new Promise((resolve, reject) => {
      giftCardsDb.remove({ _id: id }, {}, (err, numRemoved) => {
        if (err) return reject(err);
        resolve(numRemoved === 1);
      });
    });
  }
}

module.exports = GiftCard;

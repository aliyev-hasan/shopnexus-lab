const { wishlistDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');

class Wishlist {
  // İstək siyahısına məhsul əlavə et
  static async addToWishlist(userId, productId) {
    return new Promise((resolve, reject) => {
      wishlistDb.findOne({ user_id: userId, product_id: productId }, (err, doc) => {
        if (err) return reject(err);
        if (doc) return resolve(doc);
        const newItem = {
          _id: uuidv4(),
          user_id: userId,
          product_id: productId,
          created_at: new Date().toISOString()
        };
        wishlistDb.insert(newItem, (err, doc) => {
          if (err) return reject(err);
          resolve(doc);
        });
      });
    });
  }

  // İstək siyahısını göstər
  static async getWishlist(userId) {
    return new Promise((resolve, reject) => {
      wishlistDb.find({ user_id: userId }, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // İstək siyahısından məhsulu çıxar
  static async removeFromWishlist(userId, productId) {
    return new Promise((resolve, reject) => {
      wishlistDb.remove({ user_id: userId, product_id: productId }, {}, (err, numRemoved) => {
        if (err) return reject(err);
        resolve(numRemoved === 1);
      });
    });
  }
}

module.exports = Wishlist;
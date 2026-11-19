const { cartDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');

class Cart {
  // Səbətə məhsul əlavə et
  static async addToCart(userId, productId, quantity = 1) {
    const qty = Number(quantity) || 1;
    return new Promise((resolve, reject) => {
      cartDb.findOne({ user_id: userId, product_id: productId }, (err, doc) => {
        if (err) return reject(err);
        if (doc) {
          cartDb.update({ _id: doc._id }, { $inc: { quantity: qty } }, {}, (err, numUpdated) => {
            if (err) return reject(err);
            cartDb.findOne({ _id: doc._id }, (err, updatedDoc) => {
              if (err) return reject(err);
              resolve(updatedDoc);
            });
          });
        } else {
          const newItem = {
            _id: uuidv4(),
            user_id: userId,
            product_id: productId,
            quantity: qty,
            created_at: new Date().toISOString()
          };
          cartDb.insert(newItem, (err, doc) => {
            if (err) return reject(err);
            resolve(doc);
          });
        }
      });
    });
  }

  // Səbəti göstər
  static async getCart(userId) {
    return new Promise((resolve, reject) => {
      cartDb.find({ user_id: userId }, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Səbətdən məhsulu çıxar
  static async removeFromCart(userId, productId) {
    return new Promise((resolve, reject) => {
      cartDb.remove({ user_id: userId, product_id: productId }, {}, (err, numRemoved) => {
        if (err) return reject(err);
        resolve(numRemoved === 1);
      });
    });
  }

  // Səbətdəki məhsulun miqdarını yenilə
  static async updateQuantity(userId, productId, quantity) {
    const qty = Number(quantity);
    return new Promise((resolve, reject) => {
      cartDb.update({ user_id: userId, product_id: productId }, { $set: { quantity: qty } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        if (numUpdated !== 1) return resolve(false);
        cartDb.findOne({ user_id: userId, product_id: productId }, (err, doc) => {
          if (err) return reject(err);
          resolve(doc);
        });
      });
    });
  }

  // Səbəti tam təmizlə
  static async clearCart(userId) {
    return new Promise((resolve, reject) => {
      cartDb.remove({ user_id: userId }, { multi: true }, (err, numRemoved) => {
        if (err) return reject(err);
        resolve(numRemoved);
      });
    });
  }
}

module.exports = Cart;
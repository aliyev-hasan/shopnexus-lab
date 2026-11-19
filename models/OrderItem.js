const { orderItemsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');
const { roundMoney } = require('../services/money');

class OrderItem {
  // Sifariş məhsullarını toplu əlavə et
  static async createBulk(orderId, items) {
    const docs = items.map(item => ({
      _id: uuidv4(),
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      price: roundMoney(item.price)
    }));
    return new Promise((resolve, reject) => {
      orderItemsDb.insert(docs, (err, newDocs) => {
        if (err) return reject(err);
        resolve(newDocs);
      });
    });
  }

  // Sifarişə aid məhsulları göstər
  static async findByOrderId(orderId) {
    return new Promise((resolve, reject) => {
      orderItemsDb.find({ order_id: orderId }, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Bütün sifariş məhsullarını göstər
  static async findAll() {
    return new Promise((resolve, reject) => {
      orderItemsDb.find({}, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }
}

module.exports = OrderItem;

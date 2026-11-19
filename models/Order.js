const { ordersDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');
const { roundMoney } = require('../services/money');

const VALID_TRANSITIONS = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED', 'REFUNDED', 'RETURN_REQUESTED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURN_REQUESTED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED', 'CANCELLED'],
  RETURNED: [],
  REFUNDED: [],
  CANCELLED: []
};

class Order {
  // Yeni sifariş yarat
  static async create(userId, orderData) {
    const newOrder = {
      _id: uuidv4(),
      user_id: userId,
      status: orderData.status || 'PENDING_PAYMENT',
      total_amount: roundMoney(orderData.total_amount),
      shipping_address: orderData.shipping_address,
      payment_method: orderData.payment_method,
      customer_phone: orderData.customer_phone || null,
      coupon_code: orderData.coupon_code || null,
      commission_rate: orderData.commission_rate != null ? Number(orderData.commission_rate) : null,
      cashback_granted: false,
      cashback_amount: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Cari statusun nə vaxt başladığını izləyir (yalnız status dəyişəndə yenilənir).
      // Avtomatik keçid taymerləri bu sahəyə əsaslanır, ümumi updated_at-ə deyil —
      // beləliklə statusla əlaqəsi olmayan yeniləmələr (məs. cashback qeydi) taymeri sıfırlamır.
      status_changed_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      ordersDb.insert(newOrder, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Bütün sifarişləri göstər
  static async findAll() {
    return new Promise((resolve, reject) => {
      ordersDb.find({}, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Filtr obyektini birbaşa NeDB query-sinə ötürür (müştəri axtarışı üçün)
  static async findByFilter(filter) {
    return new Promise((resolve, reject) => {
      ordersDb.find(filter || {}, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Sifarişi ID ilə tap
  static async findById(id) {
    return new Promise((resolve, reject) => {
      ordersDb.findOne({ _id: id }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // İstifadəçiyə aid sifarişləri göstər
  static async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      ordersDb.find({ user_id: userId }, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Verilmiş statuslardan birində olan bütün sifarişləri tap (avtomatlaşdırma mühərriki üçün)
  static async findByStatuses(statuses) {
    return new Promise((resolve, reject) => {
      ordersDb.find({ status: { $in: statuses } }, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Sifariş statusunu yenilə (status_changed_at yalnız burada, status faktiki dəyişəndə yenilənir)
  static async updateStatus(orderId, status) {
    const now = new Date().toISOString();
    return new Promise((resolve, reject) => {
      ordersDb.update({ _id: orderId }, { $set: { status, updated_at: now, status_changed_at: now } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        if (numUpdated !== 1) return resolve(false);
        ordersDb.findOne({ _id: orderId }, (err, doc) => {
          if (err) return reject(err);
          resolve(doc);
        });
      });
    });
  }

  // Yalnız qanuni status keçidini icra et; qeyri-qanuni keçiddə false qaytar
  static async transition(orderId, fromStatuses, toStatus) {
    const order = await Order.findById(orderId);
    if (!order) return false;
    if (!Array.isArray(fromStatuses) || !fromStatuses.includes(order.status)) return false;
    return Order.updateStatus(orderId, toStatus);
  }

  // Cari statusdan hədəf statusa qanuni keçid varsa icra et (həm manual admin, həm avtomatlaşdırma bunu istifadə edir)
  static async transitionTo(orderId, toStatus) {
    const order = await Order.findById(orderId);
    if (!order) return false;
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(toStatus)) return false;
    return Order.updateStatus(orderId, toStatus);
  }

  // Cashback verilmiş kimi işarələ (idempotent) + snapshot məbləği yaz
  static async markCashbackGranted(orderId, cashbackAmount = null) {
    return new Promise((resolve, reject) => {
      ordersDb.update({ _id: orderId }, { $set: { cashback_granted: true, cashback_amount: Number(cashbackAmount) || 0, updated_at: new Date().toISOString() } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        resolve(numUpdated === 1);
      });
    });
  }

  // Cashback statusunu təyin et
  static async setCashbackGranted(orderId, granted) {
    return new Promise((resolve, reject) => {
      ordersDb.update({ _id: orderId }, { $set: { cashback_granted: !!granted, updated_at: new Date().toISOString() } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        resolve(numUpdated === 1);
      });
    });
  }
}

module.exports = Order;
module.exports.VALID_TRANSITIONS = VALID_TRANSITIONS;

const { paymentEventsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');

class PaymentEvent {
  // Ödəniş hadisəsi yarat
  static async create(paymentId, type) {
    const newEvent = {
      _id: uuidv4(),
      payment_id: paymentId,
      type,
      created_at: new Date().toISOString()
    };
    const saved = await new Promise((resolve, reject) => {
      paymentEventsDb.insert(newEvent, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
    if (['DECLINED', 'FAILED', 'TIMEOUT', 'CVV_INVALID', 'AUTH_FAILED', 'INSUFFICIENT_FUNDS'].includes(type)) {
      const { notifyAdmins } = require('../services/notificationService');
      await notifyAdmins({ type: 'PAYMENT_EXCEPTION', contextKey: 'payments', title: 'Ödəniş istisnası', message: `Ödəniş hadisəsi: ${type}`, targetRoute: '/admin/payments', targetEntityId: paymentId }).catch(() => null);
    }
    return saved;
  }

  // Ödənişə aid hadisələri tarixə görə sırala (köhnədən yeniyə)
  static async findByPaymentId(paymentId) {
    return new Promise((resolve, reject) => {
      paymentEventsDb.find({ payment_id: paymentId }).sort({ created_at: 1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }
}

module.exports = PaymentEvent;

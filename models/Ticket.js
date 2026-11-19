const { ticketsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');

// Dəstək bileti — Product Q&A-dan tamamilə fərqli, şəxsi konsepsiya (Phase 14)
const CATEGORIES = ['ORDER', 'PAYMENT', 'PRODUCT', 'ACCOUNT', 'VENDOR', 'OTHER'];
const STATUSES = ['OPEN', 'ANSWERED', 'CLOSED'];

class Ticket {
  // Yeni bilet yarat (müştəri və ya satıcı)
  static async create({ userId, role, category, message, orderId, productId }) {
    const newTicket = {
      _id: uuidv4(),
      user_id: userId,
      role: role || 'Customer', // 'Customer' | 'Vendor'
      scope: 'ADMIN',
      category: category || 'OTHER',
      order_id: orderId || null,
      product_id: productId || null,
      status: 'OPEN',
      messages: [
        { sender: 'user', sender_id: userId, text: message, created_at: new Date().toISOString() }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      ticketsDb.insert(newTicket, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  static async findAll() {
    return new Promise((resolve, reject) => {
      ticketsDb.find({}).sort({ updated_at: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs.filter(doc => !doc.scope || doc.scope === 'ADMIN'));
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      ticketsDb.findOne({ _id: id }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  static async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      ticketsDb.find({ user_id: userId }).sort({ updated_at: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs.filter(doc => !doc.scope || doc.scope === 'ADMIN'));
      });
    });
  }

  static async createVendorConversation({ customerId, vendorId, message }) {
    const now = new Date().toISOString();
    const conversation = {
      _id: uuidv4(),
      user_id: customerId,
      role: 'Customer',
      scope: 'VENDOR_CUSTOMER',
      vendor_id: vendorId,
      category: 'VENDOR',
      status: 'OPEN',
      messages: [{ sender: 'customer', sender_id: customerId, text: message, created_at: now }],
      created_at: now,
      updated_at: now
    };
    return new Promise((resolve, reject) => ticketsDb.insert(conversation, (err, doc) => err ? reject(err) : resolve(doc)));
  }

  static async findVendorConversation(customerId, vendorId) {
    return new Promise((resolve, reject) => {
      ticketsDb.find({ scope: 'VENDOR_CUSTOMER', user_id: customerId, vendor_id: vendorId }).sort({ updated_at: -1 }).limit(1).exec((err, docs) => err ? reject(err) : resolve(docs[0] || null));
    });
  }

  static async findVendorConversations(vendorId) {
    return new Promise((resolve, reject) => {
      ticketsDb.find({ scope: 'VENDOR_CUSTOMER', vendor_id: vendorId }).sort({ updated_at: -1 }).exec((err, docs) => err ? reject(err) : resolve(docs));
    });
  }

  static async addVendorMessage(id, sender, senderId, text) {
    const ticket = await Ticket.findById(id);
    if (!ticket || ticket.scope !== 'VENDOR_CUSTOMER') return null;
    const now = new Date().toISOString();
    const messages = [...(ticket.messages || []), { sender, sender_id: senderId, text, created_at: now }];
    const status = sender === 'vendor' ? 'ANSWERED' : 'OPEN';
    return new Promise((resolve, reject) => {
      ticketsDb.update({ _id: id, scope: 'VENDOR_CUSTOMER' }, { $set: { messages, status, updated_at: now } }, {}, (err, count) => {
        if (err) return reject(err);
        if (count !== 1) return resolve(null);
        Ticket.findById(id).then(resolve).catch(reject);
      });
    });
  }

  // Söhbət tarixçəsinə mesaj əlavə et (müştəri/satıcı davam mesajı və ya admin cavabı)
  static async addMessage(id, sender, senderId, text) {
    const ticket = await Ticket.findById(id);
    if (!ticket) return null;
    const messages = [...(ticket.messages || []), { sender, sender_id: senderId, text, created_at: new Date().toISOString() }];
    const newStatus = sender === 'admin' ? 'ANSWERED' : (ticket.status === 'CLOSED' ? 'OPEN' : ticket.status);
    return new Promise((resolve, reject) => {
      ticketsDb.update({ _id: id }, { $set: { messages, status: newStatus, updated_at: new Date().toISOString() } }, {}, (err) => {
        if (err) return reject(err);
        Ticket.findById(id).then(resolve).catch(reject);
      });
    });
  }

  static async setStatus(id, status) {
    return new Promise((resolve, reject) => {
      ticketsDb.update({ _id: id }, { $set: { status, updated_at: new Date().toISOString() } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        resolve(numUpdated === 1);
      });
    });
  }
}

Ticket.CATEGORIES = CATEGORIES;
Ticket.STATUSES = STATUSES;
module.exports = Ticket;

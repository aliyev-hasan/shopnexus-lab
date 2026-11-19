const { notificationsDb } = require('../config/db');
const { randomUUID } = require('crypto');

class Notification {
  static async create(data) {
    if (!data.recipientUserId || !data.type || !data.title) throw new Error('Notification recipient, type və title tələb olunur.');
    const doc = {
      _id: randomUUID(),
      recipient_user_id: String(data.recipientUserId),
      recipient_role: data.recipientRole || null,
      type: String(data.type),
      context_key: data.contextKey || null,
      title: String(data.title),
      message: String(data.message || ''),
      target_route: data.targetRoute || null,
      target_entity_id: data.targetEntityId ? String(data.targetEntityId) : null,
      read_at: null,
      created_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => notificationsDb.insert(doc, (err, saved) => err ? reject(err) : resolve(saved)));
  }

  static async findByRecipient(userId) {
    return new Promise((resolve, reject) => notificationsDb.find({ recipient_user_id: String(userId) }).sort({ created_at: -1 }).exec((err, docs) => err ? reject(err) : resolve(docs)));
  }

  static async findById(id) {
    return new Promise((resolve, reject) => notificationsDb.findOne({ _id: id }, (err, doc) => err ? reject(err) : resolve(doc)));
  }

  static async countUnread(userId) {
    return new Promise((resolve, reject) => notificationsDb.count({ recipient_user_id: String(userId), read_at: null }, (err, count) => err ? reject(err) : resolve(count)));
  }

  static async unreadCountsByContext(userId) {
    const items = await Notification.findByRecipient(userId);
    return items.filter(n => !n.read_at).reduce((counts, item) => {
      if (item.context_key) counts[item.context_key] = (counts[item.context_key] || 0) + 1;
      return counts;
    }, {});
  }

  static async markRead(id, userId) {
    return new Promise((resolve, reject) => notificationsDb.update({ _id: id, recipient_user_id: String(userId), read_at: null }, { $set: { read_at: new Date().toISOString() } }, {}, (err, count) => err ? reject(err) : resolve(count === 1)));
  }

  static async markContextRead(userId, contextKey) {
    return new Promise((resolve, reject) => notificationsDb.update({ recipient_user_id: String(userId), context_key: contextKey, read_at: null }, { $set: { read_at: new Date().toISOString() } }, { multi: true }, (err, count) => err ? reject(err) : resolve(count)));
  }

  static async markAllRead(userId) {
    return new Promise((resolve, reject) => notificationsDb.update({ recipient_user_id: String(userId), read_at: null }, { $set: { read_at: new Date().toISOString() } }, { multi: true }, (err, count) => err ? reject(err) : resolve(count)));
  }

  static async deleteByEntity(entityId) {
    return new Promise((resolve, reject) => notificationsDb.remove({ target_entity_id: String(entityId) }, { multi: true }, (err, count) => err ? reject(err) : resolve(count)));
  }
}

module.exports = Notification;

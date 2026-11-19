const { addressesDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');

class Address {
  // Yeni ünvan yarat
  static async create(data) {
    const newAddress = {
      _id: uuidv4(),
      user_id: data.user_id,
      label: data.label || 'Ev',
      full_name: data.full_name || '',
      phone: data.phone || '',
      address_line: data.address_line,
      city: data.city || '',
      is_default: data.is_default !== undefined ? !!data.is_default : false,
      created_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      addressesDb.insert(newAddress, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // İstifadəçinin ünvanları (default ünvan əvvəl)
  static async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      addressesDb.find({ user_id: userId }).sort({ is_default: -1, created_at: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Ünvanı ID ilə tap
  static async findById(id) {
    return new Promise((resolve, reject) => {
      addressesDb.findOne({ _id: id }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Yalnız sahib user yeniləyə bilər
  static async update(id, userId, data) {
    return new Promise((resolve, reject) => {
      addressesDb.update({ _id: id, user_id: userId }, { $set: data }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        resolve(numUpdated === 1);
      });
    });
  }

  // Yalnız sahib user silə bilər
  static async delete(id, userId) {
    return new Promise((resolve, reject) => {
      addressesDb.remove({ _id: id, user_id: userId }, {}, (err, numRemoved) => {
        if (err) return reject(err);
        resolve(numRemoved === 1);
      });
    });
  }

  // Default ünvanı təyin et
  static async setDefault(id, userId) {
    return new Promise((resolve, reject) => {
      addressesDb.update({ user_id: userId }, { $set: { is_default: false } }, { multi: true }, (err) => {
        if (err) return reject(err);
        addressesDb.update({ _id: id, user_id: userId }, { $set: { is_default: true } }, {}, (err, numUpdated) => {
          if (err) return reject(err);
          resolve(numUpdated === 1);
        });
      });
    });
  }

  // User-in bütün default ünvanlarını false et
  static async clearDefault(userId) {
    return new Promise((resolve, reject) => {
      addressesDb.update({ user_id: userId }, { $set: { is_default: false } }, { multi: true }, (err, numUpdated) => {
        if (err) return reject(err);
        resolve(numUpdated);
      });
    });
  }
}

module.exports = Address;

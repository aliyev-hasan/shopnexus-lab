const { settingsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');

class Setting {
  static async get(key, defaultValue = null) {
    return new Promise((resolve, reject) => {
      settingsDb.findOne({ key }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc ? doc.value : defaultValue);
      });
    });
  }

  static async set(key, value) {
    return new Promise((resolve, reject) => {
      settingsDb.findOne({ key }, (err, doc) => {
        if (err) return reject(err);
        if (doc) {
          settingsDb.update({ _id: doc._id }, { $set: { value } }, {}, (err, num) => {
            if (err) return reject(err);
            resolve(num === 1);
          });
        } else {
          settingsDb.insert({ _id: uuidv4(), key, value }, (err, newDoc) => {
            if (err) return reject(err);
            resolve(newDoc);
          });
        }
      });
    });
  }
}

module.exports = Setting;

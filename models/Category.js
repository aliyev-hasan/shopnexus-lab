const { categoriesDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');

class Category {
  // Yeni kateqoriya yarat
  static async create(data) {
    const newCategory = {
      _id: uuidv4(),
      name: data.name,
      description: data.description || null,
      created_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      categoriesDb.insert(newCategory, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Bütün kateqoriyaları göstər
  static async findAll() {
    return new Promise((resolve, reject) => {
      categoriesDb.find({}, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Kateqoriyanı ID ilə tap
  static async findById(id) {
    return new Promise((resolve, reject) => {
      categoriesDb.findOne({ _id: id }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Kateqoriyanı ad ilə tap
  static async findByName(name) {
    return new Promise((resolve, reject) => {
      categoriesDb.findOne({ name }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Kateqoriyanı yenilə
  static async update(id, data) {
    return new Promise((resolve, reject) => {
      categoriesDb.update({ _id: id }, { $set: data }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        if (numUpdated !== 1) return resolve(false);
        categoriesDb.findOne({ _id: id }, (err, doc) => {
          if (err) return reject(err);
          resolve(doc);
        });
      });
    });
  }

  // Kateqoriyanı sil
  static async delete(id) {
    return new Promise((resolve, reject) => {
      categoriesDb.remove({ _id: id }, {}, (err, numRemoved) => {
        if (err) return reject(err);
        resolve(numRemoved === 1);
      });
    });
  }
}

module.exports = Category;

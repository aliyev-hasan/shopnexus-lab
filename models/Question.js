const { questionsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');

// Statuslar: PENDING (cavabsız) -> ANSWERED (cavablanıb) və ya HANDLED (cavabsız bağlanıb, məs. münasib deyil)
const STATUSES = ['PENDING', 'ANSWERED', 'HANDLED'];

class Question {
  // Yeni sual yarat (müştəri tərəfindən)
  static async create(userId, productId, vendorId, questionText) {
    const newQuestion = {
      _id: uuidv4(),
      product_id: productId,
      vendor_id: vendorId,
      user_id: userId,
      question_text: questionText,
      status: 'PENDING',
      answer_text: null,
      answered_by: null,
      answered_at: null,
      visible: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      questionsDb.insert(newQuestion, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  static async findAll() {
    return new Promise((resolve, reject) => {
      questionsDb.find({}).sort({ created_at: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      questionsDb.findOne({ _id: id }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Məhsula aid, PUBLİC (cavablanmış və gizlədilməmiş) suallar — Product Detail üçün
  static async findPublicByProductId(productId) {
    return new Promise((resolve, reject) => {
      questionsDb.find({ product_id: productId, status: 'ANSWERED', visible: true }).sort({ answered_at: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  static async findByProductId(productId) {
    return new Promise((resolve, reject) => {
      questionsDb.find({ product_id: productId }).sort({ created_at: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  static async findByVendorId(vendorId) {
    return new Promise((resolve, reject) => {
      questionsDb.find({ vendor_id: vendorId }).sort({ created_at: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  static async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      questionsDb.find({ user_id: userId }).sort({ created_at: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Admin/vendor cavab verir
  static async answer(id, answerText, answeredBy) {
    return new Promise((resolve, reject) => {
      questionsDb.update({ _id: id }, { $set: {
        answer_text: answerText,
        answered_by: answeredBy,
        answered_at: new Date().toISOString(),
        status: 'ANSWERED',
        updated_at: new Date().toISOString()
      } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        resolve(numUpdated === 1);
      });
    });
  }

  // Cavab olmadan "handled" kimi işarələ (məs. spam/əlaqəsiz sual)
  static async markHandled(id) {
    return new Promise((resolve, reject) => {
      questionsDb.update({ _id: id }, { $set: { status: 'HANDLED', updated_at: new Date().toISOString() } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        resolve(numUpdated === 1);
      });
    });
  }

  // Moderasiya: uyğunsuz məzmunu ictimai görünüşdən gizlət/göstər
  static async setVisibility(id, visible) {
    return new Promise((resolve, reject) => {
      questionsDb.update({ _id: id }, { $set: { visible: !!visible, updated_at: new Date().toISOString() } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        resolve(numUpdated === 1);
      });
    });
  }

  static async delete(id) {
    return new Promise((resolve, reject) => {
      questionsDb.remove({ _id: id }, {}, (err, numRemoved) => {
        if (err) return reject(err);
        resolve(numRemoved === 1);
      });
    });
  }
}

Question.STATUSES = STATUSES;
module.exports = Question;

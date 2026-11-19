const { reviewsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');

class Review {
  static validateRating(value) {
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Reytinq 1 ilə 5 arasında tam rəqəm olmalıdır.');
    return rating;
  }

  // Yeni rəy yarat
  static async create(userId, productId, reviewData) {
    const rating = Review.validateRating(reviewData.rating);
    const existing = await Review.findByUserAndProduct(userId, productId);
    if (existing) throw new Error('Bu məhsula artıq rəy yazmısınız. Mövcud rəyinizi yeniləyə bilərsiniz.');
    const newReview = {
      _id: uuidv4(),
      user_id: userId,
      product_id: productId,
      rating,
      comment: reviewData.comment || null,
      created_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      reviewsDb.insert(newReview, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // İstifadəçinin rəylərini göstər (yenidən köhnəyə)
  static async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      reviewsDb.find({ user_id: userId }).sort({ created_at: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Məhsula aid rəyləri göstər
  static async findByProductId(productId) {
    return new Promise((resolve, reject) => {
      reviewsDb.find({ product_id: productId }, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  static async findByUserAndProduct(userId, productId) {
    return new Promise((resolve, reject) => {
      reviewsDb.findOne({ user_id: userId, product_id: productId }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Rəyi ID ilə tap
  static async findById(reviewId) {
    return new Promise((resolve, reject) => {
      reviewsDb.findOne({ _id: reviewId }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Rəyi yenilə
  static async update(reviewId, updateData) {
    if (updateData.rating !== undefined) updateData.rating = Review.validateRating(updateData.rating);
    return new Promise((resolve, reject) => {
      reviewsDb.update({ _id: reviewId }, { $set: updateData }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        if (numUpdated !== 1) return resolve(false);
        reviewsDb.findOne({ _id: reviewId }, (err, doc) => {
          if (err) return reject(err);
          resolve(doc);
        });
      });
    });
  }

  // Rəyi sil
  static async delete(reviewId) {
    return new Promise((resolve, reject) => {
      reviewsDb.remove({ _id: reviewId }, {}, (err, numRemoved) => {
        if (err) return reject(err);
        resolve(numRemoved === 1);
      });
    });
  }
}

module.exports = Review;

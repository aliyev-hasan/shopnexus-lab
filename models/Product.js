const { productsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');
const Category = require('./Category');

class Product {
  // Yeni məhsul yarat
  static async create(vendorId, productData) {
    let category_id = productData.category_id || null;
    if (!category_id && productData.category) {
      const category = await Category.findByName(productData.category);
      if (category) category_id = category._id;
    }
    const newProduct = {
      _id: uuidv4(),
      vendor_id: vendorId,
      name: productData.name,
      description: productData.description || null,
      price: Number(productData.price) || 0,
      stock_quantity: Number(productData.stock_quantity) || 0,
      category: productData.category || null,
      category_id: category_id,
      image_url: productData.image_url || null,
      image_urls: Array.isArray(productData.image_urls) && productData.image_urls.length ? productData.image_urls : (productData.image_url ? [productData.image_url] : []),
      rating: 0,
      reviews_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      productsDb.insert(newProduct, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Bütün məhsulları göstər
  static async findAll() {
    return new Promise((resolve, reject) => {
      productsDb.find({}, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Məhsulu ID ilə tap
  static async findById(id) {
    return new Promise((resolve, reject) => {
      productsDb.findOne({ _id: id }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Satıcıya aid məhsulları göstər
  static async findByVendorId(vendorId) {
    return new Promise((resolve, reject) => {
      productsDb.find({ vendor_id: vendorId }, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Kateqoriyaya aid məhsulları göstər
  static async findByCategoryId(categoryId) {
    return new Promise((resolve, reject) => {
      productsDb.find({ category_id: categoryId }, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Məhsulu yenilə
  static async update(productId, updateData) {
    if (updateData.category && !updateData.category_id) {
      let category = await Category.findByName(updateData.category);
      if (!category) category = await Category.findById(updateData.category);
      if (category) updateData.category_id = category._id;
    }
    if (updateData.price !== undefined) updateData.price = Number(updateData.price);
    if (updateData.stock_quantity !== undefined) updateData.stock_quantity = Number(updateData.stock_quantity);
    if (updateData.rating !== undefined) updateData.rating = Number(updateData.rating);
    if (updateData.reviews_count !== undefined) updateData.reviews_count = Number(updateData.reviews_count);
    return new Promise((resolve, reject) => {
      productsDb.update({ _id: productId }, { $set: { ...updateData, updated_at: new Date().toISOString() } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        if (numUpdated !== 1) return resolve(false);
        productsDb.findOne({ _id: productId }, (err, doc) => {
          if (err) return reject(err);
          resolve(doc);
        });
      });
    });
  }

  // Məhsulu sil
  static async delete(productId) {
    return new Promise((resolve, reject) => {
      productsDb.remove({ _id: productId }, {}, (err, numRemoved) => {
        if (err) return reject(err);
        resolve(numRemoved === 1);
      });
    });
  }

  // Stok sayını azalt (satış zamanı)
  static async decrementStock(productId, quantity) {
    return new Promise((resolve, reject) => {
      productsDb.update({ _id: productId }, { $inc: { stock_quantity: -Number(quantity) } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        resolve(numUpdated === 1);
      });
    });
  }

  // Stok sayını artır (sifariş ləğvi zamanı)
  static async incrementStock(productId, quantity) {
    return new Promise((resolve, reject) => {
      productsDb.update({ _id: productId }, { $inc: { stock_quantity: Number(quantity) } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        resolve(numUpdated === 1);
      });
    });
  }
}

module.exports = Product;

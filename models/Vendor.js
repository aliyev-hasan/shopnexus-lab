const { vendorsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');

function slugify(value) {
  return String(value || 'vendor').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'vendor';
}

class Vendor {
  // Yeni satıcı yarat
  static async create(userId, vendorData) {
    const newVendor = {
      _id: uuidv4(),
      user_id: userId,
      store_name: vendorData.store_name,
      store_description: vendorData.store_description || null,
      store_logo: vendorData.store_logo || null,
      store_banner: vendorData.store_banner || null,
      slug: vendorData.slug || `${slugify(vendorData.store_name)}-${String(userId).slice(0, 6).toLowerCase()}`,
      status: vendorData.status || 'ACTIVE',
      featured: vendorData.featured === true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => vendorsDb.insert(newVendor, (err, doc) => err ? reject(err) : resolve(doc)));
  }

  // Satıcıyı ID ilə tap
  static async findById(id) {
    return new Promise((resolve, reject) => vendorsDb.findOne({ _id: id }, (err, doc) => err ? reject(err) : resolve(doc)));
  }

  static async findBySlug(slug) {
    return new Promise((resolve, reject) => vendorsDb.findOne({ slug }, (err, doc) => err ? reject(err) : resolve(doc)));
  }

  // Bütün satıcıları göstər
  static async findAll() {
    return new Promise((resolve, reject) => vendorsDb.find({}, (err, docs) => err ? reject(err) : resolve(docs)));
  }

  // Satıcıyı user_id ilə tap
  static async findByUserId(userId) {
    return new Promise((resolve, reject) => vendorsDb.findOne({ user_id: userId }, (err, doc) => err ? reject(err) : resolve(doc)));
  }

  // Satıcı məlumatlarını yenilə
  static async update(vendorId, updateData) {
    return new Promise((resolve, reject) => vendorsDb.update({ _id: vendorId }, { $set: { ...updateData, updated_at: new Date().toISOString() } }, {}, (err, n) => err ? reject(err) : resolve(n === 1)));
  }
}

module.exports = Vendor;

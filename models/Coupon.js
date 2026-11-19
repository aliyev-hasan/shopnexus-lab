const { couponsDb } = require('../config/db');
const { randomUUID: uuidv4 } = require('crypto');
const DUPLICATE_CODE_ERROR = 'Bu kupon kodu artıq mövcuddur.';
let uniqueIndexPromise = null;

const updateRaw = (query, changes) => new Promise((resolve, reject) => couponsDb.update(query, { $set: changes }, {}, (err, count) => err ? reject(err) : resolve(count)));

function nextAvailableCode(base, usedCodes) {
  let suffix = 2;
  let candidate = `${base}-${suffix}`;
  while (usedCodes.has(candidate)) candidate = `${base}-${++suffix}`;
  return candidate;
}

class Coupon {
  // Köhnə bazadakı təkrar kodları məlumat itirmədən ayırır və sonrakı yazıları DB səviyyəsində qoruyur.
  static async ensureUniqueCodeIndex() {
    if (!uniqueIndexPromise) {
      uniqueIndexPromise = (async () => {
        const coupons = await Coupon.findAll();
        coupons.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        const usedCodes = new Set();
        for (const coupon of coupons) {
          const base = String(coupon.code || 'COUPON').trim().toUpperCase() || 'COUPON';
          const code = usedCodes.has(base) ? nextAvailableCode(base, usedCodes) : base;
          usedCodes.add(code);
          if (coupon.code !== code) await updateRaw({ _id: coupon._id }, { code, updated_at: new Date().toISOString() });
        }
        await new Promise((resolve, reject) => couponsDb.ensureIndex({ fieldName: 'code', unique: true }, err => err ? reject(err) : resolve()));
        return true;
      })().catch(err => {
        uniqueIndexPromise = null;
        throw err;
      });
    }
    return uniqueIndexPromise;
  }

  // Bütün kuponları göstər
  static async findAll() {
    return new Promise((resolve, reject) => {
      couponsDb.find({}, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Kuponu ID ilə tap
  static async findById(id) {
    return new Promise((resolve, reject) => {
      couponsDb.findOne({ _id: id }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Kuponu yenilə
  static async update(id, data) {
    await Coupon.ensureUniqueCodeIndex();
    const current = await Coupon.findById(id);
    if (!current) return false;
    const code = String(data.code || current.code || '').trim().toUpperCase();
    const duplicate = await Coupon.findByCode(code);
    if (duplicate && duplicate._id !== id) throw new Error(DUPLICATE_CODE_ERROR);
    const updateData = {
      ...data,
      code,
      updated_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      couponsDb.update({ _id: id }, { $set: updateData }, {}, (err, numUpdated) => {
        if (err) return reject(err.errorType === 'uniqueViolated' ? new Error(DUPLICATE_CODE_ERROR) : err);
        if (numUpdated !== 1) return resolve(false);
        couponsDb.findOne({ _id: id }, (err, doc) => {
          if (err) return reject(err);
          resolve(doc);
        });
      });
    });
  }

  // Kuponu sil
  static async delete(id) {
    return new Promise((resolve, reject) => {
      couponsDb.remove({ _id: id }, {}, (err, numRemoved) => {
        if (err) return reject(err);
        resolve(numRemoved === 1);
      });
    });
  }

  // Kuponu kod ilə tap
  static async findByCode(code) {
    return new Promise((resolve, reject) => {
      couponsDb.findOne({ code: String(code || '').trim().toUpperCase() }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Yeni kupon yarat
  // vendor_id === null/undefined  -> qlobal (admin) kupon, bütün satıcıların məhsullarına şamil edilir
  // vendor_id === '<vendorId>'    -> yalnız həmin satıcının məhsullarına şamil edilir
  static async create(couponData) {
    await Coupon.ensureUniqueCodeIndex();
    // Dəyərlər formadan olduğu kimi alınır — frontend-ə etibar edirik (yoxlama form tərəfində aparılır).
    const code = String(couponData.code || '').trim().toUpperCase();
    const usageLimit = couponData.usage_limit === '' || couponData.usage_limit == null ? 1000 : Number(couponData.usage_limit);
    if (await Coupon.findByCode(code)) throw new Error(DUPLICATE_CODE_ERROR);
    const newCoupon = {
      _id: uuidv4(),
      code,
      discount_type: couponData.discount_type,
      discount_value: Number(couponData.discount_value) || 0,
      expiry_date: couponData.expiry_date || null,
      min_order_value: Number(couponData.min_order_value) || 0,
      usage_limit: usageLimit,
      used_count: 0,
      vendor_id: couponData.vendor_id ? String(couponData.vendor_id) : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      couponsDb.insert(newCoupon, (err, doc) => {
        if (err) return reject(err.errorType === 'uniqueViolated' ? new Error(DUPLICATE_CODE_ERROR) : err);
        resolve(doc);
      });
    });
  }

  // Satıcıya aid kuponları göstər (vendor-only coupons)
  static async findByVendorId(vendorId) {
    return new Promise((resolve, reject) => {
      couponsDb.find({ vendor_id: vendorId }, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  // Qlobal (admin) kuponları göstər
  static async findGlobal() {
    return new Promise((resolve, reject) => {
      couponsDb.find({ vendor_id: null }, (err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
  }

  static async incrementUsageByCode(code) {
    const coupon = await Coupon.findByCode(code);
    if (!coupon) return false;
    const used = Number(coupon.used_count || 0);
    const limit = Number(coupon.usage_limit || 1000);
    if (used >= limit) return false;
    return new Promise((resolve, reject) => couponsDb.update({ _id: coupon._id, used_count: coupon.used_count }, { $set: { used_count: used + 1, updated_at: new Date().toISOString() } }, {}, (err, count) => err ? reject(err) : resolve(count === 1)));
  }
}

Coupon.DUPLICATE_CODE_ERROR = DUPLICATE_CODE_ERROR;
module.exports = Coupon;

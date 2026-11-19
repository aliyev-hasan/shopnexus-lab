const { couponsDb } = require('../config/db');

const find = query => new Promise((resolve, reject) => couponsDb.find(query, (err, docs) => err ? reject(err) : resolve(docs)));
const update = (query, changes) => new Promise((resolve, reject) => couponsDb.update(query, { $set: changes }, {}, (err, count) => err ? reject(err) : resolve(count)));

async function migrateCouponLimits() {
  const fixedCoupons = await find({ discount_type: 'fixed' });
  let updated = 0;
  for (const coupon of fixedCoupons) {
    const current = Number(coupon.discount_value);
    if (!Number.isFinite(current) || current < 1 || current > 1000) {
      const discountValue = !Number.isFinite(current) || current < 1 ? 1 : 1000;
      updated += await update({ _id: coupon._id }, { discount_value: discountValue, updated_at: new Date().toISOString() });
    }
  }
  return updated;
}

if (require.main === module) {
  migrateCouponLimits()
    .then(count => { console.log(`${count} mövcud sabit kupon 1–1000 ₼ limitinə uyğunlaşdırıldı.`); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { migrateCouponLimits };

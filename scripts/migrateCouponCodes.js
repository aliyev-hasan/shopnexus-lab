const Coupon = require('../models/Coupon');

async function migrateCouponCodes() {
  const before = await Coupon.findAll();
  const oldCodes = new Map(before.map(coupon => [coupon._id, coupon.code]));
  await Coupon.ensureUniqueCodeIndex();
  const after = await Coupon.findAll();
  return after.filter(coupon => oldCodes.get(coupon._id) !== coupon.code).map(coupon => ({ from: oldCodes.get(coupon._id), to: coupon.code }));
}

if (require.main === module) {
  migrateCouponCodes()
    .then(changes => { console.log(changes.length ? `Kupon kodları ayrıldı: ${changes.map(item => `${item.from} → ${item.to}`).join(', ')}` : 'Təkrar kupon kodu tapılmadı.'); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { migrateCouponCodes };

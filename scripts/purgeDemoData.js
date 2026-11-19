const db = require('../config/db');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

// Güclü şifrə generatoru: ən az 1 böyük, 1 kiçik, 1 rəqəm, 1 xüsusi simvol (siyasətə uyğun)
function genPassword(len = 14) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*';
  const pick = s => s[Math.floor(Math.random() * s.length)];
  let p = pick(upper) + pick(lower) + pick(digits) + pick(special);
  const all = upper + lower + digits + special;
  while (p.length < len) p += pick(all);
  return p.split('').sort(() => Math.random() - 0.5).join('');
}

const remove = (store, query) => new Promise(res => store.remove(query, { multi: true }, (e, n) => res(e ? -1 : (n || 0))));
const all = store => new Promise(res => store.find({}, (e, d) => res(e ? [] : d)));

(async () => {
  const users = await User.findAll();
  const official = users.filter(u => /@shopnexus\.cyou$/.test(String(u.email || '')));
  const officialIds = new Set(official.map(u => u._id));
  const purgeIds = new Set(users.filter(u => !officialIds.has(u._id)).map(u => u._id));
  const oldCustomer = official.find(u => u.email === 'customer@shopnexus.cyou');
  const doomed = new Set([...purgeIds, ...(oldCustomer ? [oldCustomer._id] : [])]);
  const doomedArr = [...doomed];
  const inDoomed = { $in: doomedArr };

  console.log('Purging users:', users.filter(u => doomed.has(u._id)).map(u => u.email).join(', '));

  // 1) Vendor qeydləri (purged vendor-ların)
  await remove(db.vendorsDb, { user_id: inDoomed });

  // 2) İstifadəçi əsaslı kolleksiyalar
  await remove(db.usersDb, { _id: inDoomed });
  await remove(db.walletsDb, { user_id: inDoomed });
  await remove(db.addressesDb, { user_id: inDoomed });
  await remove(db.savedCardsDb, { user_id: inDoomed });
  await remove(db.cartDb, { user_id: inDoomed });
  await remove(db.ordersDb, { user_id: inDoomed });
  await remove(db.questionsDb, { $or: [{ user_id: inDoomed }, { vendor_id: inDoomed }] });
  await remove(db.ticketsDb, { $or: [{ user_id: inDoomed }, { vendor_id: inDoomed }] });
  await remove(db.notificationsDb, { recipient_user_id: inDoomed });
  await remove(db.wishlistDb, { user_id: inDoomed });
  await remove(db.giftCardTransactionsDb, { user_id: inDoomed });

  // 3) Purged vendor-ların məhsulları (rəsmi vendor məhsulları saxlanılır)
  await remove(db.productsDb, { vendor_id: inDoomed });

  // 4) Qalan məhsullar/orderlər/payments əsasında dolayı silmələr
  const remainingProducts = await all(db.productsDb);
  const remainingOrders = await all(db.ordersDb);
  const remainingPayments = await all(db.paymentsDb);
  const remainingWallets = await all(db.walletsDb);

  await remove(db.reviewsDb, { product_id: { $nin: remainingProducts.map(p => p._id) } });
  await remove(db.orderItemsDb, { order_id: { $nin: remainingOrders.map(o => o._id) } });
  await remove(db.paymentsDb, { order_id: { $nin: remainingOrders.map(o => o._id) } });
  await remove(db.paymentEventsDb, { payment_id: { $nin: remainingPayments.map(p => p._id) } });
  await remove(db.refundsDb, { order_id: { $nin: remainingOrders.map(o => o._id) } });
  await remove(db.receiptsDb, { order_id: { $nin: remainingOrders.map(o => o._id) } });
  await remove(db.walletTransactionsDb, { wallet_id: { $nin: remainingWallets.map(w => w._id) } });

  // 5) Yetim satıcı kuponları (vendor_id rəsmi istifadəçiyə aid deyilsə silinir; qlobal kuponlar qalır)
  const allCoupons = await all(db.couponsDb);
  for (const c of allCoupons) {
    if (c.vendor_id && !officialIds.has(c.vendor_id)) await remove(db.couponsDb, { _id: c._id });
  }

  // 6) customer@ re-created fresh
  const custPassword = genPassword();
  const customer = await User.create({ full_name: 'Demo Müştəri', email: 'customer@shopnexus.cyou', password: custPassword, role: 'Customer' });
  await Wallet.create(customer._id, 0);

  // 7) Rəsmi hesablara güclü şifrə (bcrypt hashed)
  const creds = { customer: custPassword };
  for (const u of official.filter(x => x.email !== 'customer@shopnexus.cyou')) {
    const pwd = genPassword();
    await User.updatePassword(u._id, pwd);
    creds[u.email] = pwd;
  }

  // ==================== NƏTİCƏ ====================
  console.log('\n========== DEMO KREDENSİALLARI (düz mətndə) ==========');
  console.log('Admin   : admin@shopnexus.cyou    | ' + creds['admin@shopnexus.cyou']);
  console.log('Customer: customer@shopnexus.cyou | ' + creds.customer);
  console.log('Vendor  : vendor@shopnexus.cyou   | ' + creds['vendor@shopnexus.cyou']);
  console.log('---------- Digər rəsmi hesablar ----------');
  for (const u of official.filter(x => x.email !== 'customer@shopnexus.cyou' && x.email !== 'admin@shopnexus.cyou' && x.email !== 'vendor@shopnexus.cyou')) {
    console.log((u.role === 'Admin' ? 'Admin   : ' : 'Vendor  : ') + u.email.padEnd(25) + ' | ' + creds[u.email]);
  }

  // Yekun statistikası
  const finalUsers = await User.findAll();
  const counts = {};
  for (const [name, store] of Object.entries(db)) {
    counts[name] = await new Promise(res => store.count({}, (e, n) => res(e ? -1 : n)));
  }
  console.log('\n---------- Yekun saylar ----------');
  console.log('users:', finalUsers.length, '| orders:', counts.ordersDb, '| products:', counts.productsDb, '| reviews:', counts.reviewsDb, '| wallets:', counts.walletsDb, '| coupons:', counts.couponsDb, '| categories:', counts.categoriesDb, '| giftcards:', counts.giftCardsDb);
})().catch(e => { console.error('PURGE ERROR:', e); process.exit(1); });

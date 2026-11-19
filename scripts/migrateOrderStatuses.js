const { ordersDb } = require('../config/db');
const run = (db, method, ...args) => new Promise((resolve, reject) => db[method](...args, (err, r) => err ? reject(err) : resolve(r)));
const map = { 'Pending': 'PENDING_PAYMENT', 'Processing': 'PROCESSING', 'Shipped': 'SHIPPED', 'Delivered': 'DELIVERED', 'Cancelled': 'CANCELLED' };
async function migrate() {
  const orders = await run(ordersDb, 'find', {});
  for (const o of orders) {
    if (map[o.status]) {
      await run(ordersDb, 'update', { _id: o._id }, { $set: { status: map[o.status] } }, {});
    }
  }
  console.log('Order status migration tamamlandı.');
  process.exit(0);
}
migrate().catch(e => { console.error(e); process.exit(1); });

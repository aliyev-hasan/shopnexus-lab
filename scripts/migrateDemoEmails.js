const { usersDb } = require('../config/db');

const findAll = () => new Promise((resolve, reject) => usersDb.find({}, (err, docs) => err ? reject(err) : resolve(docs)));
const update = (id, email) => new Promise((resolve, reject) => usersDb.update({ _id: id }, { $set: { email, updated_at: new Date().toISOString() } }, {}, (err, count) => err ? reject(err) : resolve(count)));
const compact = () => new Promise(resolve => {
  usersDb.once('compaction.done', resolve);
  usersDb.persistence.compactDatafile();
});

async function migrateDemoEmails() {
  const users = await findAll();
  const targets = new Map([
    ['admin-demo', 'admin@shopnexus.cyou'],
    ['vendor-demo', 'vendor@shopnexus.cyou'],
    ['customer-demo', 'customer@shopnexus.cyou']
  ]);
  for (const user of users) {
    if (String(user._id).startsWith('vendor-brand-') && /@shopnexus\.com$/i.test(user.email || '')) targets.set(user._id, String(user.email).replace(/@shopnexus\.com$/i, '@shopnexus.cyou'));
  }
  const changes = [];
  for (const [id, email] of targets) {
    const user = users.find(item => item._id === id);
    if (!user || String(user.email).toLowerCase() === email.toLowerCase()) continue;
    const collision = users.find(item => item._id !== id && String(item.email).toLowerCase() === email.toLowerCase());
    if (collision) throw new Error(`${email} artıq başqa hesaba məxsusdur; təhlükəsiz miqrasiya dayandırıldı.`);
    await update(id, email);
    changes.push({ id, from: user.email, to: email });
    user.email = email;
  }
  // Köhnə .com dəyərlərinin NeDB append-log tarixçəsində qalmasını da aradan qaldırır;
  // yalnız cari canlı sənədlər yenidən yazılır, heç bir istifadəçi silinmir.
  await compact();
  return changes;
}

if (require.main === module) migrateDemoEmails().then(changes => { console.log(changes.length ? `${changes.length} demo email təhlükəsiz yeniləndi.` : 'Demo emaillər artıq aktualdır.'); process.exit(0); }).catch(err => { console.error(err); process.exit(1); });
module.exports = { migrateDemoEmails };

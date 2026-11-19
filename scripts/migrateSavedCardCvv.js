const { savedCardsDb } = require('../config/db');

const countAll = () => new Promise((resolve, reject) => savedCardsDb.count({}, (error, count) => error ? reject(error) : resolve(count)));
const removeCvvHashes = () => new Promise((resolve, reject) => savedCardsDb.update(
  { cvv_hash: { $exists: true } },
  { $unset: { cvv_hash: true } },
  { multi: true },
  (error, count) => error ? reject(error) : resolve(count)
));
const compact = () => new Promise(resolve => {
  savedCardsDb.once('compaction.done', resolve);
  savedCardsDb.persistence.compactDatafile();
});

async function migrateSavedCardCvv() {
  const before = await countAll();
  const updated = await removeCvvHashes();
  await compact();
  const after = await countAll();
  if (before !== after) throw new Error('Saved card sayı dəyişdi; miqrasiya təhlükəsizlik yoxlamasından keçmədi.');
  return { updated, count: after };
}

if (require.main === module) migrateSavedCardCvv()
  .then(result => { console.log(`${result.updated} saved card CVV hash-dən təmizləndi; ${result.count} kart qorundu.`); process.exit(0); })
  .catch(error => { console.error(error); process.exit(1); });

module.exports = { migrateSavedCardCvv };

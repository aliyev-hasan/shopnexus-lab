const util = require('util');
util.isDate = util.isDate || ((value) => Object.prototype.toString.call(value) === '[object Date]');
util.isRegExp = util.isRegExp || ((value) => Object.prototype.toString.call(value) === '[object RegExp]');
const Datastore = require('nedb');
const path = require('path');

// Fayl bazalarının yolu
const usersDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'users.db'), autoload: true });
const vendorsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'vendors.db'), autoload: true });
const productsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'products.db'), autoload: true });
const cartDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'cart.db'), autoload: true });
const categoriesDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'categories.db'), autoload: true });
const couponsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'coupons.db'), autoload: true });
const ordersDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'orders.db'), autoload: true });
const orderItemsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'order_items.db'), autoload: true });
const reviewsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'reviews.db'), autoload: true });
const wishlistDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'wishlist.db'), autoload: true });
const settingsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'settings.db'), autoload: true });
const paymentsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'payments.db'), autoload: true });
const paymentEventsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'payment_events.db'), autoload: true });
const walletsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'wallets.db'), autoload: true });
const walletTransactionsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'wallet_transactions.db'), autoload: true });
const giftCardsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'gift_cards.db'), autoload: true });
const giftCardTransactionsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'gift_card_transactions.db'), autoload: true });
const refundsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'refunds.db'), autoload: true });
const savedCardsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'saved_cards.db'), autoload: true });
const addressesDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'addresses.db'), autoload: true });
// Phase 13 — Məhsul sualları (Product Q&A)
const questionsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'questions.db'), autoload: true });
// Phase 14 — Dəstək sistemi (Support tickets)
const ticketsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'tickets.db'), autoload: true });
const notificationsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'notifications.db'), autoload: true });
const receiptsDb = new Datastore({ filename: path.join(__dirname, '..', 'data', 'receipts.db'), autoload: true });

module.exports = { usersDb, vendorsDb, productsDb, cartDb, categoriesDb, couponsDb, ordersDb, orderItemsDb, reviewsDb, wishlistDb, settingsDb, paymentsDb, paymentEventsDb, walletsDb, walletTransactionsDb, giftCardsDb, giftCardTransactionsDb, refundsDb, savedCardsDb, addressesDb, questionsDb, ticketsDb, notificationsDb, receiptsDb };

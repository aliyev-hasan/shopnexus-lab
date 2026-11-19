const Receipt = require('../models/Receipt');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Payment = require('../models/Payment');
const { roundMoney } = require('./money');

async function createTopUpReceipt({ userId, payment, transaction }) {
  const user = await User.findById(userId);
  return Receipt.create({
    operation_type: 'WALLET_TOP_UP', operation_key: `WALLET_TOP_UP:${payment._id}`,
    transaction_id: transaction._id, payment_ids: [payment._id], user_id: userId,
    customer_name: user ? user.full_name : null, payment_method: payment.method,
    amount: payment.amount, final_total: payment.amount, status: payment.status,
    card_brand: payment.card_brand, card_last4: payment.card_last4, card_contribution: payment.amount
  });
}

async function createGiftCardReceipt({ userId, giftCardTransaction, walletTransaction, amount }) {
  const user = await User.findById(userId);
  return Receipt.create({
    operation_type: 'GIFT_CARD_REDEMPTION', operation_key: `GIFT_CARD_REDEMPTION:${giftCardTransaction._id}`,
    transaction_id: walletTransaction._id, user_id: userId, customer_name: user ? user.full_name : null,
    payment_method: 'GIFT_CARD', amount, final_total: amount, wallet_contribution: amount, status: 'COMPLETED'
  });
}

async function createOrderReceipt(orderId) {
  const existing = await Receipt.findByOperationKey(`ORDER:${orderId}`);
  if (existing) return existing;
  const order = await Order.findById(orderId);
  if (!order) return null;
  const [user, orderItems, payments, vendors] = await Promise.all([User.findById(order.user_id), OrderItem.findByOrderId(orderId), Payment.findAllByOrderId(orderId), Vendor.findAll()]);
  const vendorMap = new Map(vendors.map(vendor => [vendor.user_id, vendor.store_name]));
  const items = [];
  const merchantNames = new Set();
  let subtotal = 0;
  for (const item of orderItems) {
    const product = await Product.findById(item.product_id);
    const lineTotal = roundMoney(Number(item.price) * Number(item.quantity));
    subtotal = roundMoney(subtotal + lineTotal);
    if (product && product.vendor_id && vendorMap.has(product.vendor_id)) merchantNames.add(vendorMap.get(product.vendor_id));
    items.push({ name: product ? product.name : 'Silinmiş məhsul', quantity: item.quantity, unit_price: item.price, line_total: lineTotal });
  }
  const walletContribution = payments.filter(p => p.method === 'WALLET').reduce((sum, p) => roundMoney(sum + Number(p.amount)), 0);
  const cardPayments = payments.filter(p => ['CARD_SIMULATOR', 'GOOGLE_PAY', 'APPLE_PAY'].includes(p.method));
  const cardContribution = cardPayments.reduce((sum, p) => roundMoney(sum + Number(p.amount)), 0);
  const cardPayment = cardPayments[0] || null;
  return Receipt.create({
    operation_type: 'ORDER', operation_key: `ORDER:${orderId}`, order_id: orderId,
    payment_ids: payments.map(payment => payment._id), user_id: order.user_id,
    customer_name: user ? user.full_name : null, merchant_names: [...merchantNames],
    payment_method: order.payment_method, amount: order.total_amount, final_total: order.total_amount,
    subtotal, discount: roundMoney(subtotal - Number(order.total_amount)), status: order.status,
    card_brand: cardPayment && cardPayment.card_brand, card_last4: cardPayment && cardPayment.card_last4,
    wallet_contribution: walletContribution, card_contribution: cardContribution, items,
    created_at: order.created_at
  });
}

async function createRefundReceipt({ refund, order, paymentIds = [] }) {
  const user = await User.findById(refund.user_id);
  return Receipt.create({
    operation_type: 'REFUND', operation_key: `REFUND:${refund._id}`, refund_id: refund._id,
    order_id: refund.order_id, payment_ids: paymentIds, user_id: refund.user_id,
    customer_name: user ? user.full_name : null, payment_method: order ? order.payment_method : null,
    amount: refund.amount, final_total: refund.amount, refund_amount: refund.amount,
    refund_reason: refund.reason, status: refund.status, created_at: refund.updated_at || refund.created_at
  });
}

module.exports = { createTopUpReceipt, createGiftCardReceipt, createOrderReceipt, createRefundReceipt };

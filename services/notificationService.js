const Notification = require('../models/Notification');
const User = require('../models/User');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Product = require('../models/Product');

async function notifyAdmins(data) {
  const admins = (await User.findAll()).filter(user => user.role === 'Admin' && user.isActive !== false);
  return Promise.all(admins.map(admin => Notification.create({ ...data, recipientUserId: admin._id, recipientRole: 'Admin' })));
}

async function notifyOrderCreated(orderId, suppliedItems) {
  const order = await Order.findById(orderId);
  if (!order) return;
  const items = suppliedItems || await OrderItem.findByOrderId(orderId);
  const vendorIds = [...new Set(items.map(item => item.vendor_id).filter(Boolean))];
  await Promise.all(vendorIds.map(vendorId => Notification.create({ recipientUserId: vendorId, recipientRole: 'Vendor', type: 'ORDER_NEW', contextKey: 'orders', title: 'Yeni sifariş', message: `#${orderId.slice(0, 8)} sifarişində mağazanıza aid məhsul var.`, targetRoute: '/vendor/sales', targetEntityId: orderId })));
  await Notification.create({ recipientUserId: order.user_id, recipientRole: 'Customer', type: 'ORDER_CREATED', contextKey: 'orders', title: 'Sifariş qəbul edildi', message: `#${orderId.slice(0, 8)} sifarişiniz qəbul edildi.`, targetRoute: `/orders/${orderId}`, targetEntityId: orderId });
}

async function notifyOrderStatus(orderId, status) {
  const order = await Order.findById(orderId);
  if (!order) return;
  return Notification.create({ recipientUserId: order.user_id, recipientRole: 'Customer', type: 'ORDER_STATUS_CHANGED', contextKey: 'orders', title: 'Sifariş statusu dəyişdi', message: `#${orderId.slice(0, 8)} sifarişinin yeni statusu: ${status}.`, targetRoute: `/orders/${orderId}`, targetEntityId: orderId });
}

async function notifyRefundRequested(refund, order) {
  const items = await OrderItem.findByOrderId(order._id);
  const productIds = [...new Set(items.map(item => item.product_id))];
  const products = await Promise.all(productIds.map(id => Product.findById(id).catch(() => null)));
  const vendorIds = [...new Set(products.filter(Boolean).map(product => product.vendor_id))];
  await Promise.all(vendorIds.map(vendorId => Notification.create({ recipientUserId: vendorId, recipientRole: 'Vendor', type: 'RETURN_REQUESTED', contextKey: 'returns', title: 'Geri qaytarma tələbi', message: `#${order._id.slice(0, 8)} sifarişi üçün geri qaytarma tələb edildi.`, targetRoute: '/vendor/sales', targetEntityId: refund._id })));
  await notifyAdmins({ type: 'RETURN_REQUESTED', contextKey: 'returns', title: 'Yeni geri qaytarma tələbi', message: `#${order._id.slice(0, 8)} sifarişi üçün geri qaytarma tələb edildi.`, targetRoute: '/admin/refunds', targetEntityId: refund._id });
}

module.exports = { notifyAdmins, notifyOrderCreated, notifyOrderStatus, notifyRefundRequested };

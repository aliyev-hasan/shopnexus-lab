const Ticket = require('../models/Ticket');
const { notifyAdmins } = require('../services/notificationService');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Notification = require('../models/Notification');

async function findVendor(reference) {
  return await Vendor.findBySlug(reference).catch(() => null)
    || await Vendor.findById(reference).catch(() => null)
    || await Vendor.findByUserId(reference).catch(() => null);
}

exports.showVendorContact = async (req, res) => {
  try {
    const vendor = await findVendor(req.params.vendorId);
    if (!vendor || (vendor.status || 'ACTIVE') !== 'ACTIVE') return res.status(404).render('errors/404', { title: 'Mağaza tapılmadı' });
    const conversation = await Ticket.findVendorConversation(req.user.id, vendor.user_id);
    res.render('vendors/contact', { title: `${vendor.store_name} ilə əlaqə`, vendor, conversation });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/vendors');
  }
};

exports.createVendorMessage = async (req, res) => {
  try {
    const vendor = await findVendor(req.params.vendorId);
    if (!vendor || (vendor.status || 'ACTIVE') !== 'ACTIVE') {
      req.flash('error', 'Satıcı tapılmadı!');
      return res.redirect('/vendors');
    }
    const text = String(req.body.message || '').trim();
    if (!text) {
      req.flash('error', 'Mesaj boş ola bilməz!');
      return res.redirect(`/vendors/${vendor.slug || vendor._id}/contact`);
    }
    if (text.length > 2000) {
      req.flash('error', 'Mesaj maksimum 2000 simvol ola bilər.');
      return res.redirect(`/vendors/${vendor.slug || vendor._id}/contact`);
    }
    let conversation = await Ticket.findVendorConversation(req.user.id, vendor.user_id);
    conversation = conversation
      ? await Ticket.addVendorMessage(conversation._id, 'customer', req.user.id, text)
      : await Ticket.createVendorConversation({ customerId: req.user.id, vendorId: vendor.user_id, message: text });
    const customer = await User.findById(req.user.id);
    await Notification.create({ recipientUserId: vendor.user_id, recipientRole: 'Vendor', type: 'VENDOR_MESSAGE_NEW', contextKey: 'customer_support', title: 'Müştəridən yeni mesaj', message: `${customer ? customer.full_name : 'Müştəri'} mağazanızla əlaqə saxladı.`, targetRoute: `/vendor/customer-support#conversation-${conversation._id}`, targetEntityId: conversation._id }).catch(() => null);
    req.flash('success', 'Mesajınız birbaşa satıcıya göndərildi!');
    res.redirect(`/vendors/${vendor.slug || vendor._id}/contact`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
};

exports.replyVendorConversation = async (req, res) => {
  try {
    const conversation = await Ticket.findById(req.params.id);
    if (!conversation || conversation.scope !== 'VENDOR_CUSTOMER') return res.status(404).render('errors/404', { title: 'Yazışma tapılmadı' });
    const isCustomer = req.user.role === 'Customer' && conversation.user_id === req.user.id;
    const isVendor = req.user.role === 'Vendor' && conversation.vendor_id === req.user.id;
    if (!isCustomer && !isVendor) return res.status(403).render('errors/403', { title: 'Giriş qadağandır' });
    const text = String(req.body.message || '').trim();
    if (!text) {
      req.flash('error', 'Mesaj boş ola bilməz!');
      return res.redirect('back');
    }
    if (text.length > 2000) {
      req.flash('error', 'Mesaj maksimum 2000 simvol ola bilər.');
      return res.redirect('back');
    }
    const sender = isVendor ? 'vendor' : 'customer';
    await Ticket.addVendorMessage(conversation._id, sender, req.user.id, text);
    if (isVendor) {
      const vendor = await Vendor.findByUserId(req.user.id);
      await Notification.create({ recipientUserId: conversation.user_id, recipientRole: 'Customer', type: 'VENDOR_MESSAGE_REPLIED', contextKey: 'vendor_support', title: 'Satıcı mesajınızı cavablandırdı', message: `${vendor ? vendor.store_name : 'Satıcı'} yeni cavab yazdı.`, targetRoute: `/vendors/${vendor ? (vendor.slug || vendor._id) : conversation.vendor_id}/contact`, targetEntityId: conversation._id }).catch(() => null);
      return res.redirect(`/vendor/customer-support#conversation-${conversation._id}`);
    }
    const customer = await User.findById(req.user.id);
    await Notification.create({ recipientUserId: conversation.vendor_id, recipientRole: 'Vendor', type: 'VENDOR_MESSAGE_NEW', contextKey: 'customer_support', title: 'Müştəridən yeni mesaj', message: `${customer ? customer.full_name : 'Müştəri'} yazışmaya yeni mesaj əlavə etdi.`, targetRoute: `/vendor/customer-support#conversation-${conversation._id}`, targetEntityId: conversation._id }).catch(() => null);
    const vendor = await Vendor.findByUserId(conversation.vendor_id);
    res.redirect(`/vendors/${vendor ? (vendor.slug || vendor._id) : conversation.vendor_id}/contact`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
};

// Yeni bilet yarat (müştəri və ya satıcı — req.user.role-dan asılı)
exports.createTicket = async (req, res) => {
  try {
    const { category, message, orderId, productId } = req.body;
    const text = (message || '').trim();
    if (!text) {
      req.flash('error', 'Mesaj boş ola bilməz!');
      return res.redirect('back');
    }
    const role = req.user.role === 'Vendor' ? 'Vendor' : 'Customer';
    const ticket = await Ticket.create({
      userId: req.user.id,
      role,
      category: Ticket.CATEGORIES.includes(category) ? category : 'OTHER',
      message: text,
      orderId: orderId || null,
      productId: productId || null
    });
    await notifyAdmins({ type: 'SUPPORT_REQUEST_NEW', contextKey: 'support', title: 'Yeni dəstək müraciəti', message: `${role} istifadəçidən yeni ${category || 'OTHER'} müraciəti.`, targetRoute: '/admin/support', targetEntityId: ticket._id }).catch(() => null);
    req.flash('success', 'Dəstək müraciətiniz göndərildi!');
    res.redirect(role === 'Vendor' ? '/vendor/support' : '/user/profile?tab=support');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
};

// Bilet söhbətinə davam mesajı əlavə et
exports.replyTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      req.flash('error', 'Bilet tapılmadı!');
      return res.redirect('back');
    }
    const text = (req.body.message || '').trim();
    if (!text) {
      req.flash('error', 'Mesaj boş ola bilməz!');
      return res.redirect('back');
    }
    await Ticket.addMessage(ticket._id, 'user', req.user.id, text);
    await notifyAdmins({ type: 'SUPPORT_REPLY_NEW', contextKey: 'support', title: 'Dəstək müraciətinə yeni cavab', message: `#${ticket._id.slice(0, 8)} müraciətinə istifadəçi cavab yazdı.`, targetRoute: '/admin/support', targetEntityId: ticket._id }).catch(() => null);
    res.redirect(ticket.role === 'Vendor' ? '/vendor/support' : '/user/profile?tab=support');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
};

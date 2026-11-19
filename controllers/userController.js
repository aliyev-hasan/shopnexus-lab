const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const Payment = require('../models/Payment');
const Refund = require('../models/Refund');
const SavedCard = require('../models/SavedCard');
const Order = require('../models/Order');
const Address = require('../models/Address');
const Review = require('../models/Review');
const Ticket = require('../models/Ticket');
const Question = require('../models/Question');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const fs = require('fs/promises');
const path = require('path');

async function removeManagedUpload(publicPath) {
  if (!publicPath || !String(publicPath).startsWith('/uploads/')) return;
  const uploadRoot = path.resolve(__dirname, '..', 'public', 'uploads');
  const target = path.resolve(uploadRoot, path.basename(publicPath));
  if (path.dirname(target) !== uploadRoot) return;
  await fs.unlink(target).catch(err => { if (err.code !== 'ENOENT') throw err; });
}

exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      req.flash('error', 'Şəkil seçilməyib!');
      return res.redirect('/user/profile');
    }
    const user = await User.findById(req.user.id);
    const newPath = `/uploads/${req.file.filename}`;
    await User.updateProfile(req.user.id, { profile_picture: newPath });
    if (user && user.profile_picture && user.profile_picture !== newPath) await removeManagedUpload(user.profile_picture);
    req.flash('success', 'Profil şəkli yeniləndi!');
    res.redirect('/user/profile');
  } catch (err) {
    if (req.file) await removeManagedUpload(`/uploads/${req.file.filename}`).catch(() => null);
    req.flash('error', err.message);
    res.redirect('/user/profile');
  }
};

exports.deleteProfilePicture = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.profile_picture) {
      req.flash('success', 'Profil şəkli artıq silinib.');
      return res.redirect('/user/profile');
    }
    await User.updateProfile(req.user.id, { profile_picture: null });
    await removeManagedUpload(user.profile_picture);
    req.flash('success', 'Profil şəkli silindi!');
    res.redirect('/user/profile');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/user/profile');
  }
};

// İstifadəçi Payment Center (profil səhifəsi)
exports.paymentCenter = async (req, res) => {
  try {
    if (req.user.role === 'Admin' && req.query.tab === 'support') return res.redirect('/admin/support');
    // Admin yalnız profile tab-ına, Vendor isə yalnız profile və support tab-larına daxil ola bilər.
    const requestedTab = String(req.query.tab || 'profile');
    if (req.user.role === 'Admin' && requestedTab !== 'profile') return res.redirect('/user/profile');
    if (req.user.role === 'Vendor' && requestedTab !== 'profile' && requestedTab !== 'support') return res.redirect('/user/profile');
    const user = await User.findById(req.user.id);
    if (!user) {
      req.flash('error', 'İstifadəçi tapılmadı!');
      return res.redirect('/');
    }

    let wallet = await Wallet.findByUserId(req.user.id);
    if (!wallet) {
      wallet = await Wallet.create(req.user.id, 0);
    }

    const [walletTransactions, payments, refunds, savedCards, orders, addresses, reviews, tickets, rawQuestions, products, vendors] = await Promise.all([
      WalletTransaction.findByWalletId(wallet._id),
      Payment.findByUserId(req.user.id),
      Refund.findByUserId(req.user.id),
      SavedCard.findByUserId(req.user.id),
      Order.findByUserId(req.user.id),
      Address.findByUserId(req.user.id),
      Review.findByUserId(req.user.id),
      Ticket.findByUserId(req.user.id),
      Question.findByUserId(req.user.id),
      Product.findAll(),
      Vendor.findAll()
    ]);
    // Sifarişlər yaradılma tarixinə görə azalan sırada göstərilir (yenidən köhnəyə)
    orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const productMap = new Map(products.map(product => [product._id, product]));
    const vendorMap = new Map(vendors.map(vendor => [vendor.user_id, vendor]));
    const questions = rawQuestions.map(question => ({
      ...question,
      product_name: (productMap.get(question.product_id) || {}).name || 'Silinmiş məhsul',
      vendor_name: (vendorMap.get(question.vendor_id) || {}).store_name || 'Silinmiş satıcı'
    }));

    res.render('user/profile', {
      title: 'Profil',
      user,
      wallet,
      walletTransactions,
      payments,
      refunds,
      savedCards,
      orders,
      addresses,
      reviews,
      tickets,
      questions,
      ticketCategories: Ticket.CATEGORIES,
      tab: req.query.tab || 'profile'
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/');
  }
};

// Yeni ünvan əlavə et
exports.addAddress = async (req, res) => {
  try {
    const { label, full_name, phone, address_line, city } = req.body;
    if (!address_line) {
      req.flash('error', 'Ünvan xətti tələb olunur!');
      return res.redirect('/user/profile?tab=addresses');
    }
    const existing = await Address.findByUserId(req.user.id);
    const isDefault = existing.length === 0;
    await Address.create({ user_id: req.user.id, label: label || 'Ev', full_name: full_name || '', phone: phone || '', address_line, city: city || '', is_default: isDefault });
    req.flash('success', 'Ünvan əlavə edildi!');
    res.redirect('/user/profile?tab=addresses');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/user/profile?tab=addresses');
  }
};

// Ünvanı yenilə
exports.updateAddress = async (req, res) => {
  try {
    const { label, full_name, phone, address_line, city } = req.body;
    const updated = await Address.update(req.params.id, req.user.id, { label, full_name, phone, address_line, city });
    if (!updated) {
      req.flash('error', 'Ünvan tapılmadı və ya icazəniz yoxdur!');
    } else {
      req.flash('success', 'Ünvan yeniləndi!');
    }
    res.redirect('/user/profile?tab=addresses');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/user/profile?tab=addresses');
  }
};

// Ünvanı sil
exports.deleteAddress = async (req, res) => {
  try {
    const deleted = await Address.delete(req.params.id, req.user.id);
    if (!deleted) {
      req.flash('error', 'Ünvan tapılmadı və ya icazəniz yoxdur!');
    } else {
      req.flash('success', 'Ünvan silindi!');
    }
    res.redirect('/user/profile?tab=addresses');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/user/profile?tab=addresses');
  }
};

// Default ünvanı təyin et
exports.setDefaultAddress = async (req, res) => {
  try {
    const ok = await Address.setDefault(req.params.id, req.user.id);
    if (!ok) {
      req.flash('error', 'Ünvan tapılmadı və ya icazəniz yoxdur!');
    } else {
      req.flash('success', 'Default ünvan təyin edildi!');
    }
    res.redirect('/user/profile?tab=addresses');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/user/profile?tab=addresses');
  }
};

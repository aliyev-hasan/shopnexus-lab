const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const { calculateDiscount } = require('../services/pricingService');
const { roundMoney, formatMoney } = require('../services/money');
const { safeInternalUrl } = require('../services/urlSafety');

// Geri qayıtma hədəfi yalnız daxili relative yol ola bilər (açıq redirect bloklanır)
function back(req, res, fallback) {
  const redirect = req.body.redirect || req.query.redirect || req.get('referer') || fallback;
  return safeInternalUrl(redirect, fallback);
}

function parsePositiveQty(quantity) {
  const qty = Number(quantity);
  return Number.isInteger(qty) && qty >= 1 ? qty : null;
}

// Səbətə məhsul əlavə et
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const product = await Product.findById(productId);
    if (!product) {
      req.flash('error', 'Məhsul tapılmadı!');
      return res.redirect(back(req, res, '/products'));
    }
    const qty = parsePositiveQty(quantity);
    if (qty === null) {
      req.flash('error', 'Miqdar ən azı 1 olmalıdır!');
      return res.redirect(back(req, res, `/products/${productId}`));
    }
    if (qty > product.stock_quantity) {
      req.flash('error', 'Kifayət qədər stok yoxdur!');
      return res.redirect(back(req, res, `/products/${productId}`));
    }
    await Cart.addToCart(req.user.id, productId, qty);
    req.flash('success', 'Məhsul səbətə əlavə edildi!');
    res.redirect(back(req, res, '/products'));
  } catch (err) {
    req.flash('error', err.message);
    res.redirect(back(req, res, '/products'));
  }
};

// Səbəti göstər
exports.getCart = async (req, res) => {
  try {
    const cartItems = await Cart.getCart(req.user.id);
    const items = [];
    for (const item of cartItems) {
      const product = await Product.findById(item.product_id);
      if (product) items.push({ ...item, product, lineTotal: Math.max(0, roundMoney(product.price * item.quantity)) });
    }
    const subtotal = items.reduce((sum, item) => roundMoney(sum + item.lineTotal), 0);
    const lines = items.map(item => ({ price: item.product.price, quantity: item.quantity, vendor_id: item.product.vendor_id }));

    // Kupon endirimini hesabla (satıcıya məxsus kuponlar yalnız həmin satıcının sətirlərinə tətbiq olunur)
    let discount = 0;
    let couponCode = req.session.couponCode || null;
    if (couponCode) {
      const coupon = await Coupon.findByCode(couponCode);
      if (coupon) {
        const result = calculateDiscount(coupon, lines);
        if (!result.error) discount = result.discount;
        else {
          // Səbət dəyişib və kupon artıq etibarsızdırsa, sessiyadan təmizlə
          req.session.couponCode = null;
          couponCode = null;
        }
      }
    }
    const total = roundMoney(subtotal - discount);
    res.render('cart/index', { title: 'Səbət', items, subtotal, discount, total, couponCode });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/');
  }
};

// Kuponu tətbiq et
exports.applyCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    const cartItems = await Cart.getCart(req.user.id);
    const items = [];
    for (const item of cartItems) {
      const product = await Product.findById(item.product_id);
      if (product) items.push({ ...item, product, lineTotal: Math.max(0, roundMoney(product.price * item.quantity)) });
    }
    const subtotal = items.reduce((sum, item) => roundMoney(sum + item.lineTotal), 0);
    const lines = items.map(item => ({ price: item.product.price, quantity: item.quantity, vendor_id: item.product.vendor_id }));

    const coupon = await Coupon.findByCode(code);
    if (!coupon) {
      req.flash('error', 'Kupon tapılmadı!');
      return res.redirect('/cart');
    }
    const result = calculateDiscount(coupon, lines);
    if (result.error) {
      req.flash('error', result.error);
      return res.redirect('/cart');
    }
    req.session.couponCode = code;
    req.flash('success', `Kupon tətbiq edildi! Endirim: ${formatMoney(result.discount)} ₼`);
    res.redirect('/cart');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/cart');
  }
};

// Səbətdən məhsulu çıxar
exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    await Cart.removeFromCart(req.user.id, productId);
    req.flash('success', 'Məhsul səbətdən çıxarıldı!');
    res.redirect('/cart');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/cart');
  }
};

// Səbətdəki məhsulun miqdarını yenilə
exports.updateQuantity = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const product = await Product.findById(productId);
    if (!product) {
      req.flash('error', 'Məhsul tapılmadı!');
      return res.redirect('/cart');
    }
    const qty = parseInt(quantity, 10);
    if (Number.isNaN(qty) || qty < 1) {
      req.flash('error', 'Miqdar ən azı 1 olmalıdır!');
      return res.redirect('/cart');
    }
    if (qty > product.stock_quantity) {
      req.flash('error', `"${product.name}" üçün maksimum stok ${product.stock_quantity} ədəddir!`);
      return res.redirect('/cart');
    }
    await Cart.updateQuantity(req.user.id, productId, qty);
    res.redirect('/cart');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/cart');
  }
};

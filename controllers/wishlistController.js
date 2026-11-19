const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { safeInternalUrl } = require('../services/urlSafety');

// İstək siyahısına məhsul əlavə et
exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await Product.findById(productId);
    if (!product) {
      req.flash('error', 'Məhsul tapılmadı!');
      return res.redirect('/products');
    }
    await Wishlist.addToWishlist(req.user.id, productId);
    req.flash('success', 'Məhsul istək siyahısına əlavə edildi!');
    res.redirect(safeInternalUrl(req.get('referer'), '/products'));
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/products');
  }
};

// İstək siyahısını göstər
exports.getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.getWishlist(req.user.id);
    const items = [];
    for (const item of wishlist) {
      const product = await Product.findById(item.product_id);
      if (product) items.push(product);
    }
    res.render('wishlist/index', { title: 'İstək Siyahısı', items });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/');
  }
};

// İstək siyahısından məhsulu çıxar
exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    await Wishlist.removeFromWishlist(req.user.id, productId);
    req.flash('success', 'Məhsul istək siyahısından çıxarıldı!');
    res.redirect('/wishlist');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/wishlist');
  }
};

// İstək siyahısından səbətə köçür
exports.moveToCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await Product.findById(productId);
    if (!product) {
      req.flash('error', 'Məhsul tapılmadı!');
      return res.redirect('/wishlist');
    }
    await Cart.addToCart(req.user.id, productId, 1);
    await Wishlist.removeFromWishlist(req.user.id, productId);
    req.flash('success', 'Məhsul səbətə köçürüldü!');
    res.redirect('/wishlist');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/wishlist');
  }
};

// Wishlist toggle (AJAX)
exports.toggle = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ error: 'Məhsul ID tələb olunur!' });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Məhsul tapılmadı!' });
    }
    const existing = await Wishlist.getWishlist(req.user.id);
    const alreadyIn = existing.some(item => item.product_id === productId);

    if (alreadyIn) {
      await Wishlist.removeFromWishlist(req.user.id, productId);
    } else {
      await Wishlist.addToWishlist(req.user.id, productId);
    }
    const updated = await Wishlist.getWishlist(req.user.id);
    res.json({ added: !alreadyIn, wishlistCount: updated.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

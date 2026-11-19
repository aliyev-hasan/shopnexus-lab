const Product = require('../models/Product');
const Review = require('../models/Review');
const Wishlist = require('../models/Wishlist');
const Vendor = require('../models/Vendor');
const Question = require('../models/Question');
const User = require('../models/User');
const { applyProductFilters } = require('../services/productFilterService');

// Satıcı tərəfindən göndərilə bilən məhsul sahələri (allowlist).
// rating/reviews_count/vendor_id/featured/status kimi sistem sahələri heç vaxt
// istifadəçi body-sindən qəbul edilmir.
const VENDOR_PRODUCT_FIELDS = ['name', 'description', 'price', 'stock_quantity', 'category', 'category_id'];

function pickVendorFields(body) {
  const data = {};
  for (const key of VENDOR_PRODUCT_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (data.price !== undefined) {
    const price = Number(data.price);
    if (!Number.isFinite(price) || price < 0) throw new Error('Qiymət müsbət rəqəm olmalıdır.');
    data.price = price;
  }
  if (data.stock_quantity !== undefined) {
    const stock = Number(data.stock_quantity);
    if (!Number.isInteger(stock) || stock < 0) throw new Error('Stok miqdarı müsbət tam ədəd olmalıdır.');
    data.stock_quantity = stock;
  }
  return data;
}

// Ad + soyadın ilk hərfi (məs. "Elvin M.") — müştərinin şəxsi məlumatlarını ictimai etmədən göstərmək üçün
function publicDisplayName(fullName) {
  if (!fullName) return 'Müştəri';
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

// Yeni məhsul yarat
exports.createProduct = async (req, res) => {
  try {
    const image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || null);
    const product = await Product.create(req.user.id, { ...pickVendorFields(req.body), image_url });
    if (req.accepts('html')) {
      req.flash('success', 'Məhsul uğurla əlavə edildi!');
      return res.redirect('/vendor/dashboard');
    }
    res.status(201).json(product);
  } catch (err) {
    if (req.accepts('html')) {
      req.flash('error', err.message);
      return res.redirect('/vendor/dashboard');
    }
    res.status(500).json({ error: err.message });
  }
};

// Suspend edilmiş satıcıların məhsulları kataloq/siyahı səhifələrində göstərilmir.
async function getSuspendedVendorIds() {
  const vendors = await Vendor.findAll().catch(() => []);
  return new Set(vendors.filter(v => (v.status || 'ACTIVE') === 'SUSPENDED').map(v => v.user_id));
}

// Bütün məhsulları göstər
exports.getAllProducts = async (req, res) => {
  try {
    const filtered = applyProductFilters(await Product.findAll(), req.query);
    const suspendedVendorIds = await getSuspendedVendorIds();
    let products = filtered.products.filter(p => !suspendedVendorIds.has(p.vendor_id));
    const currentUser = res.locals.user;
    const wishlist = currentUser ? await Wishlist.getWishlist(currentUser.id) : [];
    const vendors = await Vendor.findAll().catch(() => []);
    const vendorMap = new Map(vendors.map(v => [v.user_id, v]));
    products.forEach(p => {
      const vendor = vendorMap.get(p.vendor_id);
      if (vendor) p.vendor_name = vendor.store_name;
    });
    res.render('products/index', { title: 'Məhsullar', products, query: filtered.query, priceRangeAdjusted: filtered.priceRangeAdjusted, wishlistIds: [...new Set(wishlist.map(w => w.product_id))], categories: ['Elektronika','Geyim','Aksessuar','Ev əşyaları','Kosmetika','İdman','Kitablar'] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Məhsul detalları
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Məhsul tapılmadı!' });
    }
    const reviews = await Review.findByProductId(product._id);
    // Phase 13 — ictimai Q&A: yalnız cavablanmış və gizlədilməmiş suallar
    const publicQuestions = await Question.findPublicByProductId(product._id).catch(() => []);
    const questionUserIds = [...new Set(publicQuestions.map(q => q.user_id))];
    const questionUsers = await Promise.all(questionUserIds.map(id => User.findById(id).catch(() => null)));
    const questionUserMap = new Map(questionUsers.filter(Boolean).map(u => [u._id, u]));
    const questions = publicQuestions.map(q => ({
      ...q,
      asker_name: publicDisplayName(questionUserMap.get(q.user_id) && questionUserMap.get(q.user_id).full_name)
    }));
    const all = await Product.findAll();
    const suspendedVendorIds = await getSuspendedVendorIds();
    const similar = all.filter(p => p.category === product.category && p._id !== product._id && !suspendedVendorIds.has(p.vendor_id)).slice(0, 4);
    const currentUser = res.locals.user;
    const wishlist = currentUser ? await Wishlist.getWishlist(currentUser.id) : [];
    const vendor = await Vendor.findByUserId(product.vendor_id).catch(() => null);
    if (vendor) product.vendor_name = vendor.store_name;
    const allVendors = await Vendor.findAll().catch(() => []);
    const vendorMap = new Map(allVendors.map(v => [v.user_id, v]));
    similar.forEach(p => {
      const v = vendorMap.get(p.vendor_id);
      if (v) p.vendor_name = v.store_name;
    });
    res.render('products/show', { title: product.name, product, vendor, reviews, questions, similar, wishlistIds: [...new Set(wishlist.map(w => w.product_id))] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Satıcıya aid məhsulları göstər
exports.getVendorProducts = async (req, res) => {
  try {
    const products = await Product.findByVendorId(req.user.id);
    if (req.accepts('html')) {
      return res.render('vendor/products', { title: 'Məhsullarım', products });
    }
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Məhsulu yenilə
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.vendor_id !== req.user.id) {
      return res.status(404).json({ error: 'Məhsul tapılmadı və ya icazəniz yoxdur!' });
    }
    const updateData = pickVendorFields(req.body);
    if (req.file) updateData.image_url = `/uploads/${req.file.filename}`;
    const updatedProduct = await Product.update(req.params.id, updateData);
    if (req.accepts('html')) {
      req.flash('success', 'Məhsul uğurla yeniləndi!');
      return res.redirect('/vendor/dashboard');
    }
    res.json(updatedProduct);
  } catch (err) {
    if (req.accepts('html')) {
      req.flash('error', err.message);
      return res.redirect('/vendor/dashboard');
    }
    res.status(500).json({ error: err.message });
  }
};

// Məhsulu sil
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.vendor_id !== req.user.id) {
      return res.status(404).json({ error: 'Məhsul tapılmadı və ya icazəniz yoxdur!' });
    }
    await Product.delete(req.params.id);
    if (req.accepts('html')) {
      req.flash('success', 'Məhsul uğurla silindi!');
      return res.redirect('/vendor/dashboard');
    }
    res.json({ message: 'Məhsul uğurla silindi!' });
  } catch (err) {
    if (req.accepts('html')) {
      req.flash('error', err.message);
      return res.redirect('/vendor/dashboard');
    }
    res.status(500).json({ error: err.message });
  }
};

// Məhsulun stokunu yenilə
exports.updateStock = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.vendor_id !== req.user.id) {
      return res.status(404).json({ error: 'Məhsul tapılmadı və ya icazəniz yoxdur!' });
    }
    const stock = parseInt(req.body.stock_quantity, 10);
    if (Number.isNaN(stock) || stock < 0) {
      return res.status(400).json({ error: 'Stok dəyəri müsbət tam ədəd olmalıdır!' });
    }
    const updatedProduct = await Product.update(req.params.id, { stock_quantity: stock });
    if (req.accepts('html')) {
      req.flash('success', 'Stok yeniləndi!');
      return res.redirect('/vendor/dashboard');
    }
    res.json(updatedProduct);
  } catch (err) {
    if (req.accepts('html')) {
      req.flash('error', err.message);
      return res.redirect('/vendor/dashboard');
    }
    res.status(500).json({ error: err.message });
  }
};

const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Vendor = require('../models/Vendor');
const Setting = require('../models/Setting');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const Refund = require('../models/Refund');
const GiftCard = require('../models/GiftCard');
const Payment = require('../models/Payment');
const Question = require('../models/Question');
const { getCommissionRate, getCommissionPercent } = require('../config/commission');
const { reverseCashback } = require('../services/cashbackService');
const { NON_REVENUE_STATUSES, ORDER_AUTOMATION_DEFAULTS } = require('../config/orderStatuses');
const orderAutomationService = require('../services/orderAutomationService');
const { processDueTransitions } = orderAutomationService;
const Notification = require('../models/Notification');
const { notifyOrderStatus } = require('../services/notificationService');
const { createRefundReceipt } = require('../services/receiptService');
const { roundMoney, formatMoney } = require('../services/money');
const { validatePassword, passwordError } = require('../utils/passwordPolicy');

// Sistem konfiqurasiyası
exports.systemConfig = async (req, res) => {
  try {
    const [commission, cashback, forceResult, delayMs, automation] = await Promise.all([
      Setting.get('commission_rate', 0),
      Setting.get('cashback_percent', 3),
      Setting.get('payment_force_result', null),
      Setting.get('payment_delay_ms', 0),
      orderAutomationService.getSettings().catch(() => null)
    ]);
    res.json({
      commission_rate: commission,
      cashback_percent: cashback,
      payment_force_result: forceResult,
      payment_delay_ms: delayMs,
      order_automation: automation,
      node_env: process.env.NODE_ENV || 'development',
      public_base_url: process.env.PUBLIC_BASE_URL || null,
      db_files: ['users', 'vendors', 'products', 'orders', 'payments', 'wallets', 'coupons', 'gift_cards', 'refunds', 'receipts']
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin dashboard (analitika)
exports.dashboard = async (req, res) => {
  try {
    await processDueTransitions().catch(() => null);
    const [users, products, orders, orderItems] = await Promise.all([
      User.findAll(),
      Product.findAll(),
      Order.findAll(),
      OrderItem.findAll()
    ]);

    const gmv = orders
      .filter(o => !NON_REVENUE_STATUSES.includes(o.status))
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    // Komissiya gəliri — hər sifarişin öz snapshot rate-i ilə hesablanır
    const commissionPercent = await getCommissionPercent();
    const commissionRevenue = orders
      .filter(o => !NON_REVENUE_STATUSES.includes(o.status))
      .reduce((sum, o) => {
        const rate = o.commission_rate != null ? Number(o.commission_rate) : (commissionPercent / 100);
        return sum + (Number(o.total_amount || 0) * rate);
      }, 0);

    // Son 7 gün üzrə gəlir
    const revenueLabels = [];
    const revenueData = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      revenueLabels.push(key);
      const dayTotal = orders
        .filter(o => !NON_REVENUE_STATUSES.includes(o.status) && o.created_at && o.created_at.slice(0, 10) === key)
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      revenueData.push(dayTotal);
    }

    // Kateqoriya üzrə satış (orderItems + products join)
    const productMap = new Map(products.map(p => [p._id, p]));
    const categorySales = {};
    orderItems.forEach(item => {
      const product = productMap.get(item.product_id);
      if (!product) return;
      const categoryName = product.category || product.category_id || 'Kateqoriyasız';
      categorySales[categoryName] = (categorySales[categoryName] || 0) + Number(item.quantity || 0);
    });
    const categoryLabels = Object.keys(categorySales);
    const categoryData = Object.values(categorySales);

    // Ən çox satılan məhsullar (top 5)
    const productSales = {};
    orderItems.forEach(item => {
      productSales[item.product_id] = (productSales[item.product_id] || 0) + Number(item.quantity || 0);
    });
    const topProducts = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topProductsLabels = [];
    const topProductsData = [];
    for (const [productId, qty] of topProducts) {
      const product = await Product.findById(productId);
      topProductsLabels.push(product ? product.name : productId);
      topProductsData.push(qty);
    }

    // Ən aktiv müştərilər (top 5)
    const orderCounts = {};
    orders.forEach(order => {
      orderCounts[order.user_id] = (orderCounts[order.user_id] || 0) + 1;
    });
    const topUserIds = Object.entries(orderCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topCustomers = [];
    for (const [userId, orderCount] of topUserIds) {
      const user = await User.findById(userId);
      if (user) {
        topCustomers.push({ full_name: user.full_name, email: user.email, orderCount });
      }
    }

    res.render('admin/dashboard', {
      title: 'Admin Panel',
      users,
      products,
      orders,
      gmv,
      commissionRate: commissionPercent / 100,
      commissionPercent,
      commissionRevenue,
      revenueLabels,
      revenueData,
      categoryLabels,
      categoryData,
      topProductsLabels,
      topProductsData,
      topCustomers
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
};

// İstifadəçilər
exports.listUsers = async (req, res) => {
  try {
    let users = await User.findAll();
    const { search, role } = req.query;
    if (search) {
      const term = search.toLowerCase();
      users = users.filter(u =>
        (u.full_name && u.full_name.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term))
      );
    }
    if (role) {
      users = users.filter(u => u.role === role);
    }
    res.render('admin/users', { title: 'İstifadəçilər', users, query: req.query });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
};

// Admin tərəfindən yeni istifadəçi (Customer və ya Vendor) yaradılması.
// Vendor rolu seçilibsə, Vendor entiteti də (store_name ilə) birlikdə yaradılır.
exports.createUser = async (req, res) => {
  try {
    const { full_name, email, password, role, store_name } = req.body;
    if (!full_name || !full_name.trim()) {
      req.flash('error', 'Ad Soyad tələb olunur!');
      return res.redirect('/admin/users');
    }
    if (!email || !email.trim()) {
      req.flash('error', 'Email tələb olunur!');
      return res.redirect('/admin/users');
    }
    if (!password) {
      req.flash('error', 'Şifrə tələb olunur!');
      return res.redirect('/admin/users');
    }
    const pwdError = passwordError(password);
    if (pwdError) {
      return res.status(400).json({ success: false, error: pwdError });
    }
    const allowedRoles = ['Customer', 'Vendor', 'Admin'];
    if (!allowedRoles.includes(role)) {
      req.flash('error', 'Yanlış rol seçilib!');
      return res.redirect('/admin/users');
    }
    const existing = await User.findByEmail(email.trim());
    if (existing) {
      req.flash('error', 'Bu email artıq istifadə olunur!');
      return res.redirect('/admin/users');
    }
    if (role === 'Vendor' && (!store_name || !store_name.trim())) {
      req.flash('error', 'Satıcı üçün mağaza adı tələb olunur!');
      return res.redirect('/admin/users');
    }

    const user = await User.create({ full_name: full_name.trim(), email: email.trim(), password, role });
    await Wallet.create(user._id, 0).catch(() => null);

    if (role === 'Vendor') {
      await Vendor.create(user._id, { store_name: store_name.trim() });
    }

    req.flash('success', `${role === 'Vendor' ? 'Satıcı' : role === 'Admin' ? 'Admin' : 'Müştəri'} uğurla yaradıldı!`);
    res.redirect('/admin/users');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/users');
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    await User.updateRole(req.params.id, req.body.role);
    req.flash('success', 'İstifadəçi rolu yeniləndi!');
    res.redirect('/admin/users');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/users');
  }
};

exports.toggleUserActive = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'İstifadəçi tapılmadı!');
      return res.redirect('/admin/users');
    }
    await User.setActive(req.params.id, !user.isActive);
    req.flash('success', 'İstifadəçi statusu yeniləndi!');
    res.redirect('/admin/users');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/users');
  }
};

exports.resetUserPassword = async (req, res) => {
  try {
    const newPassword = req.body.newPassword;
    if (!newPassword) {
      req.flash('error', 'Yeni şifrə boş ola bilməz!');
      return res.redirect('/admin/users');
    }
    const pwdError = passwordError(newPassword);
    if (pwdError) {
      return res.status(400).json({ success: false, error: pwdError });
    }
    await User.updatePassword(req.params.id, newPassword);
    req.flash('success', 'İstifadəçi şifrəsi yeniləndi!');
    res.redirect('/admin/users');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/users');
  }
};

// ==== Satıcılar (Vendors) — istifadəçilərdən ayrı, dedicated admin bölməsi ====

exports.listVendors = async (req, res) => {
  try {
    const [vendors, users, products] = await Promise.all([
      Vendor.findAll(),
      User.findAll(),
      Product.findAll()
    ]);
    const usersById = {};
    users.forEach(u => { usersById[u._id] = u; });
    const productsByVendor = {};
    products.forEach(p => { (productsByVendor[p.vendor_id] = productsByVendor[p.vendor_id] || []).push(p); });

    const vendorRows = vendors.map(v => {
      const owner = usersById[v.user_id] || null;
      const productCount = (productsByVendor[v.user_id] || []).length;
      return { vendor: v, owner, productCount };
    });

    res.render('admin/vendors', { title: 'Satıcılar', vendorRows });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
};

exports.vendorDetail = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      req.flash('error', 'Satıcı tapılmadı!');
      return res.redirect('/admin/vendors');
    }
    const [owner, products, allOrderItems, allOrders, coupons] = await Promise.all([
      User.findById(vendor.user_id),
      Product.findAll(),
      OrderItem.findAll(),
      Order.findAll(),
      Coupon.findByVendorId(vendor.user_id)
    ]);
    const vendorProducts = products.filter(p => p.vendor_id === vendor.user_id);
    const vendorProductIds = new Set(vendorProducts.map(p => p._id));
    const ordersById = {};
    allOrders.forEach(o => { ordersById[o._id] = o; });

    // Bu satıcının məhsullarına aid order-item-lər (gəlirsiz statuslar xaric)
    const vendorItems = allOrderItems.filter(item => {
      if (!vendorProductIds.has(item.product_id)) return false;
      const order = ordersById[item.order_id];
      return order && !NON_REVENUE_STATUSES.includes(order.status);
    });
    const totalSales = vendorItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const vendorOrderIds = new Set(vendorItems.map(item => item.order_id));
    const vendorOrders = allOrders.filter(o => vendorOrderIds.has(o._id));

    res.render('admin/vendor-detail', {
      title: vendor.store_name,
      vendor,
      owner,
      products: vendorProducts,
      orders: vendorOrders,
      coupons,
      totalSales,
      totalOrders: vendorOrders.length
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/vendors');
  }
};

exports.toggleVendorStatus = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      req.flash('error', 'Satıcı tapılmadı!');
      return res.redirect('/admin/vendors');
    }
    const currentStatus = vendor.status || 'ACTIVE';
    const nextStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    await Vendor.update(vendor._id, { status: nextStatus });
    req.flash('success', `Satıcı statusu "${nextStatus}" olaraq yeniləndi!`);
    res.redirect('/admin/vendors/' + vendor._id);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/vendors');
  }
};

exports.toggleVendorFeatured = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      req.flash('error', 'Satıcı tapılmadı!');
      return res.redirect('/admin/vendors');
    }
    await Vendor.update(vendor._id, { featured: vendor.featured !== true });
    req.flash('success', vendor.featured === true ? 'Satıcı seçilmiş siyahıdan çıxarıldı.' : 'Satıcı seçilmiş siyahıya əlavə edildi.');
    res.redirect('/admin/vendors/' + vendor._id);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/vendors');
  }
};

// Məhsullar
exports.listProducts = async (req, res) => {
  try {
    const [products, vendors, categories] = await Promise.all([
      Product.findAll(),
      Vendor.findAll(),
      Category.findAll()
    ]);
    const vendorMap = new Map(vendors.map(v => [v.user_id, v]));
    const categoryMap = new Map(categories.map(c => [c._id, c.name]));
    products.forEach(p => {
      if (!p.vendor_name) {
        const vendor = vendorMap.get(p.vendor_id);
        if (vendor) p.vendor_name = vendor.store_name;
      }
      if (p.category_id && categoryMap.has(p.category_id)) p.category_name = categoryMap.get(p.category_id);
    });
    res.render('admin/products', { title: 'Məhsullar', products, vendors, categories, query: req.query });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
};

exports.editProduct = async (req, res) => {
  try {
    const [product, categories] = await Promise.all([
      Product.findById(req.params.id),
      Category.findAll()
    ]);
    if (!product) {
      req.flash('error', 'Məhsul tapılmadı!');
      return res.redirect('/admin/products');
    }
    res.render('admin/edit-product', { title: 'Məhsulu Düzəlt', product, categories });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/products');
  }
};

exports.updateProduct = async (req, res) => {
  try {
    await Product.update(req.params.id, req.body);
    req.flash('success', 'Məhsul uğurla yeniləndi!');
    res.redirect('/admin/products');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/products');
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await Product.delete(req.params.id);
    req.flash('success', 'Məhsul uğurla silindi!');
    res.redirect('/admin/products');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/products');
  }
};

// Kateqoriyalar
exports.listCategories = async (req, res) => {
  try {
    const categories = await Category.findAll();
    res.render('admin/categories', { title: 'Kateqoriyalar', categories });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
};

exports.createCategory = async (req, res) => {
  try {
    await Category.create(req.body);
    req.flash('success', 'Kateqoriya uğurla yaradıldı!');
    res.redirect('/admin/categories');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/categories');
  }
};

exports.updateCategory = async (req, res) => {
  try {
    await Category.update(req.params.id, req.body);
    req.flash('success', 'Kateqoriya uğurla yeniləndi!');
    res.redirect('/admin/categories');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/categories');
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    await Category.delete(req.params.id);
    const products = await Product.findAll();
    const related = products.filter(p => p.category_id === req.params.id);
    for (const product of related) {
      await Product.update(product._id, { category_id: null });
    }
    req.flash('success', 'Kateqoriya uğurla silindi!');
    res.redirect('/admin/categories');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/categories');
  }
};

// Kuponlar
exports.listCoupons = async (req, res) => {
  try {
    const [coupons, vendors] = await Promise.all([Coupon.findAll(), Vendor.findAll()]);
    const vendorsById = {};
    // vendorsById burada kuponun vendor_id-si (satıcı sahibinin user_id-si) ilə uyğunlaşdırılır
    vendors.forEach(v => { vendorsById[v.user_id] = v; });
    res.render('admin/coupons', { title: 'Kuponlar', coupons, vendors, vendorsById });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
};

// Formdan seçilən Vendor._id-ni real sahiblik açarına (Vendor.user_id) çevirir —
// Coupon.vendor_id məhz bununla (Product.vendor_id ilə eyni açarla) müqayisə olunur.
async function resolveVendorOwnerId(rawVendorId) {
  const trimmed = rawVendorId && String(rawVendorId).trim();
  if (!trimmed) return null;
  const vendor = await Vendor.findById(trimmed);
  return vendor ? vendor.user_id : null;
}

exports.createCoupon = async (req, res) => {
  try {
    // Boş seçim ("Bütün satıcılar / qlobal") -> null, əks halda konkret satıcıya bağlanır
    const vendor_id = await resolveVendorOwnerId(req.body.vendor_id);
    await Coupon.create({ ...req.body, vendor_id });
    req.flash('success', vendor_id ? 'Satıcıya məxsus kupon uğurla yaradıldı!' : 'Qlobal kupon uğurla yaradıldı!');
    res.redirect('/admin/coupons');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/coupons');
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const vendor_id = await resolveVendorOwnerId(req.body.vendor_id);
    await Coupon.update(req.params.id, { ...req.body, vendor_id });
    req.flash('success', 'Kupon uğurla yeniləndi!');
    res.redirect('/admin/coupons');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/coupons');
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    await Coupon.delete(req.params.id);
    req.flash('success', 'Kupon uğurla silindi!');
    res.redirect('/admin/coupons');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/coupons');
  }
};

// Sifarişlər
exports.listOrders = async (req, res) => {
  try {
    // Siyahı göstərilməzdən əvvəl hazır olan avtomatik keçidləri icra et (Phase 9.1 sinxronizasiya)
    await processDueTransitions().catch(() => null);
    let orders = await Order.findAll();
    const users = await User.findAll();
    const userMap = new Map(users.map(u => [u._id, u]));

    orders.forEach(order => {
      const user = userMap.get(order.user_id);
      order.customer_name = user ? user.full_name : 'Naməlum';
      order.customer_email = user ? user.email : '';
    });

    const { status, search, date } = req.query;
    if (status) {
      orders = orders.filter(o => o.status === status);
    }
    if (search) {
      const term = search.toLowerCase();
      orders = orders.filter(o =>
        (o._id && o._id.toLowerCase().includes(term)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(term)) ||
        (o.customer_email && o.customer_email.toLowerCase().includes(term))
      );
    }
    if (date) {
      orders = orders.filter(o => o.created_at && o.created_at.slice(0, 10) === date);
    }

    res.render('admin/orders', { title: 'Sifarişlər', orders, users, query: req.query });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const updated = await Order.transitionTo(req.params.id, req.body.status);
    if (!updated) {
      req.flash('error', 'Yanlış status keçidi!');
      return res.redirect('/admin/orders');
    }

    req.flash('success', 'Sifariş statusu yeniləndi!');
    await notifyOrderStatus(req.params.id, req.body.status).catch(() => null);
    res.redirect('/admin/orders');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/orders');
  }
};

// Ödəniş simulyatoru səhifəsi
exports.paymentSimulatorPage = async (req, res) => {
  try {
    const forceResult = await Setting.get('payment_force_result', null);
    const delayMs = await Setting.get('payment_delay_ms', 0);
    res.render('admin/payments', { title: 'Ödəniş Simulyatoru', forceResult, delayMs });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
};

// Ödəniş simulyatoru tənzimləmələrini saxla
exports.updatePaymentSimulator = async (req, res) => {
  try {
    const allowedResults = ['', 'SUCCESS', 'DECLINED', 'INSUFFICIENT_FUNDS', 'AUTH_REQUIRED', 'TIMEOUT'];
    const forceResult = req.body.force_result || '';
    const delayMs = Number(req.body.delay_ms);

    if (!allowedResults.includes(forceResult)) {
      req.flash('error', 'Yanlış məcburi nəticə!');
      return res.redirect('/admin/payments');
    }
    if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > 3000) {
      req.flash('error', 'Gecikmə 0-3000 ms aralığında olmalıdır!');
      return res.redirect('/admin/payments');
    }

    await Setting.set('payment_force_result', forceResult);
    await Setting.set('payment_delay_ms', delayMs);
    req.flash('success', 'Ödəniş simulyatoru yeniləndi!');
    res.redirect('/admin/payments');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/payments');
  }
};

// Tənzimləmələr
exports.settingsPage = async (req, res) => {
  try {
    const commissionPercent = await getCommissionPercent();
    const cashbackPercent = Number(await Setting.get('cashback_percent', 3));
    const orderAutomation = await orderAutomationService.getSettings();
    res.render('admin/settings', { title: 'Tənzimləmələr', commissionPercent, cashbackPercent, orderAutomation });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
};

// Admin → Settings → Order Automation (Phase 8.4)
exports.updateOrderAutomation = async (req, res) => {
  try {
    const allowedUnits = ['seconds', 'minutes', 'hours'];
    const enabled = req.body.enabled === 'on' || req.body.enabled === 'true' || req.body.enabled === '1';
    const unit = allowedUnits.includes(req.body.unit) ? req.body.unit : ORDER_AUTOMATION_DEFAULTS.unit;
    const delayPaidToProcessing = Number(req.body.delay_paid_to_processing);
    const delayProcessingToShipped = Number(req.body.delay_processing_to_shipped);
    const delayShippedToDelivered = Number(req.body.delay_shipped_to_delivered);

    const delays = [delayPaidToProcessing, delayProcessingToShipped, delayShippedToDelivered];
    if (delays.some(d => !Number.isFinite(d) || d < 0)) {
      req.flash('error', 'Gecikmə dəyərləri müsbət ədəd olmalıdır!');
      return res.redirect('/admin/settings');
    }

    await orderAutomationService.updateSettings({
      enabled,
      unit,
      delay_paid_to_processing: delayPaidToProcessing,
      delay_processing_to_shipped: delayProcessingToShipped,
      delay_shipped_to_delivered: delayShippedToDelivered
    });
    req.flash('success', 'Sifariş avtomatlaşdırma tənzimləmələri yeniləndi!');
    res.redirect('/admin/settings');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/settings');
  }
};

exports.updateCommission = async (req, res) => {
  try {
    const rate = Number(req.body.commission_rate);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      req.flash('error', 'Komissiya 0-100 arası faiz olmalıdır!');
      return res.redirect('/admin/settings');
    }
    await Setting.set('commission_rate', rate);
    req.flash('success', 'Komissiya faizi yeniləndi!');
    res.redirect('/admin/settings');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/settings');
  }
};

exports.updateCashback = async (req, res) => {
  try {
    const rate = Number(req.body.cashback_rate);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      req.flash('error', 'Cashback 0-100 arası faiz olmalıdır!');
      return res.redirect('/admin/settings');
    }
    await Setting.set('cashback_percent', rate);
    req.flash('success', 'Cashback faizi yeniləndi!');
    res.redirect('/admin/settings');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/settings');
  }
};

// Gift Card idarəetməsi
exports.listGiftCards = async (req, res) => {
  try {
    const giftCards = await GiftCard.findAll();
    res.render('admin/giftcards', { title: 'Gift Card-lar', giftCards });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
};

exports.createGiftCard = async (req, res) => {
  try {
    const balance = Number(req.body.balance);
    if (!Number.isFinite(balance) || balance <= 0) {
      req.flash('error', 'Gift card balansı 0-dan böyük olmalıdır!');
      return res.redirect('/admin/giftcards');
    }
    await GiftCard.create(balance);
    req.flash('success', 'Gift card yaradıldı!');
    res.redirect('/admin/giftcards');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/giftcards');
  }
};

exports.deleteGiftCard = async (req, res) => {
  try {
    const deleted = await GiftCard.delete(req.params.id);
    if (!deleted) {
      req.flash('error', 'Gift card tapılmadı!');
    } else {
      req.flash('success', 'Gift card silindi!');
    }
    res.redirect('/admin/giftcards');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/giftcards');
  }
};

// Geri qaytarmalar
exports.listRefunds = async (req, res) => {
  try {
    const refunds = await Refund.findAll();
    const orders = await Order.findAll();
    const users = await User.findAll();
    const orderMap = new Map(orders.map(o => [o._id, o]));
    const userMap = new Map(users.map(u => [u._id, u]));
    refunds.forEach(refund => {
      const order = orderMap.get(refund.order_id);
      const user = userMap.get(refund.user_id);
      refund.order = order || null;
      refund.user_name = user ? user.full_name : 'Naməlum';
    });
    res.render('admin/refunds', { title: 'Geri qaytarmalar', refunds });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
};

exports.approveRefund = async (req, res) => {
  try {
    const refund = await Refund.findById(req.params.id);
    if (!refund) {
      req.flash('error', 'Geri qaytarma tapılmadı!');
      return res.redirect('/admin/refunds');
    }

    const order = await Order.findById(refund.order_id);
    const orderItems = await OrderItem.findByOrderId(refund.order_id);

    // 1) Məhsulları vendor stokuna qaytar
    for (const item of orderItems) {
      await Product.incrementStock(item.product_id, item.quantity);
    }

    // 2) Sifariş statusunu REFUNDED et
    await Order.updateStatus(refund.order_id, 'REFUNDED');

    // 3) Cashback verilmişdisə geri al
    const cashbackReversal = await reverseCashback(refund.order_id).catch(() => ({ reversed: false }));

    // 4) Müştəriyə pulu ödəniş üsuluna görə qaytar
    const paymentList = await Payment.findAllByOrderId(refund.order_id);

    // Ödəniş üsulunu müəyyən et (order.payment_method)
    const method = order ? order.payment_method : null;
    let refundMessage = 'Geri qaytarma təsdiqləndi və cüzdana əlavə edildi!';

    // Geri qaytarılan məhsulların adlarını tap (izah üçün)
    const refundedProductNames = [];
    for (const item of orderItems) {
      const product = await Product.findById(item.product_id).catch(() => null);
      if (product) refundedProductNames.push(product.name);
    }
    const refundDescription = refundedProductNames.length
      ? `Geri qaytarılan mal: ${refundedProductNames.join(', ')} (Order #${refund.order_id.slice(0, 8)})`
      : `Geri qaytarma — Order #${refund.order_id.slice(0, 8)}`;

    if (method === 'WALLET' || method === 'SPLIT_PAYMENT') {
      // Cüzdan + (split-də) kart hissəsi də cüzdana qaytarılır.
      // Ümumi qaytarılan məbləğ CAPTURED ödənişlərin cəminə bərabər olmalıdır.
      const capturedTotal = paymentList
        .filter(p => p.status === 'CAPTURED')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const totalRefundAmount = capturedTotal > 0 ? capturedTotal : Number(refund.amount);

      let wallet = await Wallet.findByUserId(refund.user_id);
      if (!wallet) {
        wallet = await Wallet.create(refund.user_id, 0);
      }
      const newBalance = roundMoney(Number(wallet.balance) + totalRefundAmount);
      await Wallet.updateBalance(wallet._id, newBalance);
      await WalletTransaction.create({
        wallet_id: wallet._id,
        type: 'REFUND',
        amount: totalRefundAmount,
        balance_after: newBalance,
        status: 'AVAILABLE',
        description: refundDescription
      });
      refundMessage = `${formatMoney(totalRefundAmount)} ₼ cüzdanınıza qaytarıldı!`;
    } else if (method === 'CASH_ON_DELIVERY') {
      // Qapıda ödəniş — heç nə çəkilməyib, yalnız status
      refundMessage = 'Qapıda ödənişli sifariş geri qaytarıldı.';
    } else {
      // Kart ödənişi — kart simulyasiyası olduğu üçün cüzdana qaytarırıq (sadəlik)
      let wallet = await Wallet.findByUserId(refund.user_id);
      if (!wallet) {
        wallet = await Wallet.create(refund.user_id, 0);
      }
      const cardRefund = Number(refund.amount);
      const newBalance = roundMoney(Number(wallet.balance) + cardRefund);
      await Wallet.updateBalance(wallet._id, newBalance);
      await WalletTransaction.create({
        wallet_id: wallet._id,
        type: 'REFUND',
        amount: cardRefund,
        balance_after: newBalance,
        status: 'AVAILABLE',
        description: refundDescription
      });
      refundMessage = `${formatMoney(cardRefund)} ₼ cüzdanınıza qaytarıldı!`;
    }

    await Refund.updateStatus(refund._id, 'APPROVED');
    await createRefundReceipt({ refund: { ...refund, status: 'APPROVED', updated_at: new Date().toISOString() }, order, paymentIds: paymentList.map(payment => payment._id) }).catch(() => null);
    await Notification.create({ recipientUserId: refund.user_id, recipientRole: 'Customer', type: 'RETURN_APPROVED', contextKey: 'returns', title: 'Geri qaytarma təsdiqləndi', message: refundMessage, targetRoute: '/user/profile?tab=refunds', targetEntityId: refund._id }).catch(() => null);
    req.flash('success', refundMessage);
    res.redirect('/admin/refunds');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/refunds');
  }
};

exports.rejectRefund = async (req, res) => {
  try {
    const refund = await Refund.findById(req.params.id);
    if (!refund) {
      req.flash('error', 'Geri qaytarma tapılmadı!');
      return res.redirect('/admin/refunds');
    }
    await Refund.updateStatus(refund._id, 'REJECTED');
    await Notification.create({ recipientUserId: refund.user_id, recipientRole: 'Customer', type: 'RETURN_REJECTED', contextKey: 'returns', title: 'Geri qaytarma rədd edildi', message: 'Geri qaytarma tələbiniz rədd edildi.', targetRoute: '/user/profile?tab=refunds', targetEntityId: refund._id }).catch(() => null);
    req.flash('success', 'Geri qaytarma rədd edildi!');
    res.redirect('/admin/refunds');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/refunds');
  }
};

// Maliyyə Mərkəzi
exports.financePage = async (req, res) => {
  try {
    const [payments, orders, wallets, walletTransactions, refunds] = await Promise.all([
      Payment.findAll(),
      Order.findAll(),
      Wallet.findAll(),
      WalletTransaction.findAll(),
      Refund.findAll()
    ]);

    const orderMap = new Map(orders.map(o => [o._id, o]));

    // Phase 12.2 — bir ödənişin "gəlir" sayılması üçün ona bağlı sifarişin də
    // hələ gəlir sayılan statusda olması lazımdır (CANCELLED/REFUNDED/RETURN_*
    // sifarişlərin ödənişi — məsələn, tutulmamış Qapıda ödəniş — fantom gəlir kimi sayılmamalıdır).
    const isRevenueEligiblePayment = (p) => {
      if (p.status !== 'CAPTURED') return false;
      const order = orderMap.get(p.order_id);
      return !order || !NON_REVENUE_STATUSES.includes(order.status);
    };

    const totalRevenue = payments
      .filter(isRevenueEligiblePayment)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const pendingPayments = payments.filter(p =>
      ['REQUIRES_AUTHENTICATION', 'CREATED', 'PROCESSING'].includes(p.status)
    );

    const successfulPayments = payments.filter(p => p.status === 'CAPTURED').length;
    const failedPayments = payments.filter(p => ['FAILED', 'DECLINED'].includes(p.status)).length;

    const totalRefunds = refunds
      .filter(r => r.status === 'APPROVED')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const netSales = totalRevenue - totalRefunds;

    const walletLiability = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);

    // Yalnız hələ gəlir sayılan (ləğv edilməmiş) Qapıda ödəniş sifarişlərinin dəyəri
    const cashOnDelivery = payments
      .filter(p => p.method === 'CASH_ON_DELIVERY' && isRevenueEligiblePayment(p))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // Cashback öhdəliyi = verilmiş cashback - geri alınmış (reversed) cashback (xalis öhdəlik)
    const cashbackGranted = walletTransactions
      .filter(t => t.type === 'CASHBACK')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const cashbackReversed = walletTransactions
      .filter(t => t.type === 'CASHBACK_REVERSAL')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const cashbackLiability = Math.max(0, cashbackGranted - cashbackReversed);

    // Son 7 gün gəlir
    const revenueLabels = [];
    const revenueData = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      revenueLabels.push(key);
      const dayTotal = payments
        .filter(p => p.status === 'CAPTURED' && p.created_at && p.created_at.slice(0, 10) === key)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      revenueData.push(dayTotal);
    }

    // Ödəniş üsulu bölgüsü
    const methodCounts = {};
    payments.forEach(p => {
      methodCounts[p.method] = (methodCounts[p.method] || 0) + 1;
    });
    const methodLabels = Object.keys(methodCounts);
    const methodData = Object.values(methodCounts);

    res.render('admin/finance', {
      title: 'Maliyyə Mərkəzi',
      payments,
      orders,
      wallets,
      walletTransactions,
      refunds,
      totalRevenue,
      netSales,
      pendingPayments,
      successfulPayments,
      failedPayments,
      totalRefunds,
      walletLiability,
      cashOnDelivery,
      cashbackLiability,
      revenueLabels,
      revenueData,
      methodLabels,
      methodData
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
};

// ==========================================================
// Phase 13 — Məhsul sualları (Product Q&A) — Admin moderasiya
// ==========================================================

// Sualları göstər (məhsul/satıcı üzrə filtrlə)
exports.listQuestions = async (req, res) => {
  try {
    let questions = await Question.findAll();
    const [products, vendors] = await Promise.all([
      Product.findAll().catch(() => []),
      Vendor.findAll().catch(() => [])
    ]);
    const userIds = [...new Set(questions.map(q => q.user_id))];
    const users = await Promise.all(userIds.map(id => User.findById(id).catch(() => null)));
    const userMap = new Map(users.filter(Boolean).map(u => [u._id, u]));
    const productMap = new Map(products.map(p => [p._id, p]));
    const vendorMap = new Map(vendors.map(v => [v.user_id, v]));

    const { productId, vendorId, status } = req.query;
    if (productId) questions = questions.filter(q => q.product_id === productId);
    if (vendorId) questions = questions.filter(q => q.vendor_id === vendorId);
    if (status) questions = questions.filter(q => q.status === status);

    questions = questions.map(q => ({
      ...q,
      product_name: (productMap.get(q.product_id) || {}).name || 'Silinmiş məhsul',
      vendor_name: (vendorMap.get(q.vendor_id) || {}).store_name || 'Silinmiş satıcı',
      customer_name: (userMap.get(q.user_id) || {}).full_name || 'Silinmiş istifadəçi',
      customer_email: (userMap.get(q.user_id) || {}).email || null
    }));

    res.render('admin/questions', {
      title: 'Məhsul sualları',
      questions,
      products,
      vendors,
      filters: { productId: productId || '', vendorId: vendorId || '', status: status || '' }
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
};

// Suala cavab ver (public görünəcək)
exports.answerQuestion = async (req, res) => {
  try {
    const { answerText } = req.body;
    const text = (answerText || '').trim();
    if (!text) {
      req.flash('error', 'Cavab mətni boş ola bilməz!');
      return res.redirect('/admin/questions');
    }
    const question = await Question.findById(req.params.id);
    if (!question) {
      req.flash('error', 'Sual tapılmadı!');
      return res.redirect('/admin/questions');
    }
    await Question.answer(question._id, text, 'Admin');
    await Notification.create({ recipientUserId: question.user_id, recipientRole: 'Customer', type: 'PRODUCT_QUESTION_ANSWERED', contextKey: 'questions', title: 'Sualınız cavablandı', message: text, targetRoute: '/user/profile?tab=questions', targetEntityId: question._id });
    req.flash('success', 'Cavab göndərildi və məhsul səhifəsində göstəriləcək!');
    res.redirect('/admin/questions');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/questions');
  }
};

// Cavab vermədən "handled" (həll olunub) kimi işarələ
exports.markQuestionHandled = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      req.flash('error', 'Sual tapılmadı!');
      return res.redirect('/admin/questions');
    }
    await Question.markHandled(question._id);
    req.flash('success', 'Sual həll olunmuş kimi işarələndi!');
    res.redirect('/admin/questions');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/questions');
  }
};

// Moderasiya: uyğunsuz/məzmunu ictimai göstərmə siyahısından gizlət və ya bərpa et
exports.toggleQuestionVisibility = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      req.flash('error', 'Sual tapılmadı!');
      return res.redirect('/admin/questions');
    }
    await Question.setVisibility(question._id, !question.visible);
    req.flash('success', question.visible ? 'Sual ictimai görünüşdən gizlədildi!' : 'Sual yenidən ictimai edildi!');
    res.redirect('/admin/questions');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/questions');
  }
};

// ==========================================================
// Phase 14 — Dəstək sistemi — Admin Support Center
// ==========================================================
const Ticket = require('../models/Ticket');

exports.listTickets = async (req, res) => {
  try {
    let tickets = await Ticket.findAll();
    const userIds = [...new Set(tickets.map(t => t.user_id))];
    const users = await Promise.all(userIds.map(id => User.findById(id).catch(() => null)));
    const userMap = new Map(users.filter(Boolean).map(u => [u._id, u]));

    const { role, category, status } = req.query;
    if (role) tickets = tickets.filter(t => t.role === role);
    if (category) tickets = tickets.filter(t => t.category === category);
    if (status) tickets = tickets.filter(t => t.status === status);

    tickets = tickets.map(t => ({
      ...t,
      requester_name: (userMap.get(t.user_id) || {}).full_name || 'Silinmiş istifadəçi',
      requester_email: (userMap.get(t.user_id) || {}).email || null
    }));

    res.render('admin/support', {
      title: 'Dəstək Mərkəzi',
      tickets,
      ticketCategories: Ticket.CATEGORIES,
      filters: { role: role || '', category: category || '', status: status || '' }
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
};

exports.replyTicket = async (req, res) => {
  try {
    const text = (req.body.message || '').trim();
    if (!text) {
      req.flash('error', 'Cavab mətni boş ola bilməz!');
      return res.redirect('/admin/support');
    }
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      req.flash('error', 'Bilet tapılmadı!');
      return res.redirect('/admin/support');
    }
    await Ticket.addMessage(ticket._id, 'admin', req.user.id, text);
    await Notification.create({ recipientUserId: ticket.user_id, recipientRole: ticket.role, type: 'SUPPORT_ANSWERED', contextKey: 'support', title: 'Dəstək müraciətiniz cavablandı', message: text, targetRoute: ticket.role === 'Vendor' ? '/vendor/support' : '/user/profile?tab=support', targetEntityId: ticket._id }).catch(() => null);
    req.flash('success', 'Cavab göndərildi!');
    res.redirect('/admin/support');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/support');
  }
};

exports.closeTicket = async (req, res) => {
  try {
    await Ticket.setStatus(req.params.id, 'CLOSED');
    req.flash('success', 'Bilet bağlandı!');
    res.redirect('/admin/support');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/support');
  }
};

exports.reopenTicket = async (req, res) => {
  try {
    await Ticket.setStatus(req.params.id, 'OPEN');
    req.flash('success', 'Bilet yenidən açıldı!');
    res.redirect('/admin/support');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/support');
  }
};

const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const OrderItem = require('../models/OrderItem');
const Order = require('../models/Order');
const User = require('../models/User');
const Wishlist = require('../models/Wishlist');
const Coupon = require('../models/Coupon');
const Ticket = require('../models/Ticket');
const Question = require('../models/Question');
const { getCommissionRate } = require('../config/commission');
const { NON_REVENUE_STATUSES } = require('../config/orderStatuses');
const { processDueTransitions } = require('../services/orderAutomationService');
const Notification = require('../models/Notification');
const { notifyAdmins } = require('../services/notificationService');
const { getVendorSummaries } = require('../services/vendorDirectoryService');
const { applyProductFilters } = require('../services/productFilterService');

exports.listDirectory = async (req, res) => {
  try {
    let vendorRows = await getVendorSummaries({ activeOnly: true });
    const allRows = vendorRows;
    const search = String(req.query.search || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim();
    if (search) vendorRows = vendorRows.filter(row => `${row.vendor.store_name} ${row.vendor.store_description || ''}`.toLowerCase().includes(search));
    if (category) vendorRows = vendorRows.filter(row => row.categories.includes(category));
    const categories = [...new Set(allRows.flatMap(row => row.categories))].sort();
    vendorRows.sort((a, b) => b.rating - a.rating || b.productCount - a.productCount);
    res.render('vendors/index', { title: 'Bütün Satıcılar', vendorRows, categories, query: req.query });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/');
  }
};

// Customer-in Vendor olması
exports.onboardVendor = async (req, res) => {
  try {
    const { store_name, store_description } = req.body;
    if (!store_name) {
      req.flash('error', 'Mağaza adı tələb olunur!');
      return res.redirect('/vendor/onboarding');
    }
    const existing = await Vendor.findByUserId(req.user.id);
    if (existing) {
      req.flash('error', 'Siz artıq vendorsunuz!');
      return res.redirect('/vendor/dashboard');
    }
    await Vendor.create(req.user.id, { store_name, store_description });
    await User.updateRole(req.user.id, 'Vendor');
    await notifyAdmins({ type: 'VENDOR_NEW', contextKey: 'vendors', title: 'Yeni satıcı', message: `${store_name} mağazası yaradıldı.`, targetRoute: '/admin/vendors', targetEntityId: req.user.id }).catch(() => null);
    req.flash('success', 'Vendor oldunuz! Yeni token üçün yenidən giriş edin.');
    res.redirect('/auth/logout');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/vendor/onboarding');
  }
};

// Onboarding səhifəsi
exports.onboarding = (req, res) => {
  res.render('vendor/onboarding', { title: 'Vendor Ol' });
};

// Satış məlumatlarını hesabla (statistika + detallar)
async function getSalesData(userId) {
  // Metriklərdən əvvəl hazır olan avtomatik status keçidlərini icra et (Phase 9.1 sinxronizasiya)
  await processDueTransitions().catch(() => null);
  const products = await Product.findByVendorId(userId);
  const productIds = new Set(products.map(p => p._id));

  const [allOrderItems, allOrders, allUsers] = await Promise.all([
    OrderItem.findAll(),
    Order.findAll(),
    User.findAll()
  ]);

  const orderMap = new Map(allOrders.map(o => [o._id, o]));
  const userMap = new Map(allUsers.map(u => [u._id, u]));
  const productMap = new Map(products.map(p => [p._id, p]));

  // Vendor-a aid bütün item-lar (statusdan asılı olmayaraq)
  const vendorItems = allOrderItems.filter(item => {
    const order = orderMap.get(item.order_id);
    return productIds.has(item.product_id) && order;
  });

  // Real gəlir sayılan item-lar (lğv/refund/return statusları xaric)
  const retainedItems = vendorItems.filter(item => {
    const order = orderMap.get(item.order_id);
    return order && !NON_REVENUE_STATUSES.includes(order.status);
  });

  // Refunded item-lar (gəlirə daxil deyil, amma history-də qalır)
  const refundedItems = vendorItems.filter(item => {
    const order = orderMap.get(item.order_id);
    return order && order.status === 'REFUNDED';
  });

  // Ləğv edilmiş item-lar (gəlirə daxil deyil, amma history-də qalır)
  const cancelledItems = vendorItems.filter(item => {
    const order = orderMap.get(item.order_id);
    return order && order.status === 'CANCELLED';
  });

  const currentRate = await getCommissionRate();

  // Xam satış (Gross Sales): YALNIZ gəlir sayılan (NON_REVENUE_STATUSES xaric) sifarişlərin cəmi.
  // Kritik qayda: ləğv edilmiş/geri qaytarılmış sifarişlər HEÇ bir satış metrikasına (Gross və ya Net) daxil edilmməməlidir.
  const grossRevenue = retainedItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

  // Refund və ləğv ayrıca göstərilir
  const refundAmount = refundedItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  const cancellationAmount = cancelledItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

  // Satılan məhsul (yalnız qalan satış)
  const totalSold = retainedItems.reduce((sum, item) => sum + Number(item.quantity), 0);

  // Xalis satış = yalnız qalan (retained) satışlar
  const netSales = retainedItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

  // Komissiya yalnız qalan (retained) satışdan hesablanır
  const commission = retainedItems.reduce((sum, item) => {
    const order = orderMap.get(item.order_id);
    const rate = order && order.commission_rate != null ? Number(order.commission_rate) : currentRate;
    return sum + (Number(item.price) * Number(item.quantity) * rate);
  }, 0);
  const netRevenue = netSales - commission;

  // Sales details: bütün item-lar (retained + refunded), refunded statusu ilə
  const salesDetails = vendorItems.map(item => {
    const order = orderMap.get(item.order_id);
    const product = productMap.get(item.product_id);
    const customer = order ? userMap.get(order.user_id) : null;
    const rate = order && order.commission_rate != null ? Number(order.commission_rate) : currentRate;
    const lineTotal = Number(item.price) * Number(item.quantity);
    const itemCommission = lineTotal * rate;
    return {
      product_name: product ? product.name : 'Məhsul silinib',
      quantity: Number(item.quantity),
      price: Number(item.price),
      line_total: lineTotal,
      commission: itemCommission,
      commission_rate: rate,
      customer_name: customer ? customer.full_name : 'Naməlum',
      customer_email: customer ? customer.email : '',
      order_date: order ? order.created_at : null,
      order_id: item.order_id,
      refunded: order ? order.status === 'REFUNDED' : false,
      cancelled: order ? order.status === 'CANCELLED' : false
    };
  });
  salesDetails.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

  return { totalSold, grossRevenue, netSales, commission, netRevenue, commissionRate: currentRate, salesDetails, refundAmount, cancellationAmount };
}

// Satıcı məlumatlarını göstər
exports.getVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByUserId(req.user.id);
    if (!vendor) {
      return res.render('vendor/onboarding', { title: 'Vendor Ol' });
    }
    if (req.user.role !== 'Vendor') {
      return res.redirect('/auth/logout');
    }
    const products = await Product.findByVendorId(req.user.id);
    const sales = await getSalesData(req.user.id);

    res.render('vendor/dashboard', {
      title: 'Vendor Dashboard',
      vendor,
      products,
      ...sales
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/');
  }
};

// Satış tarixçəsi səhifəsi
exports.getSales = async (req, res) => {
  try {
    const vendor = await Vendor.findByUserId(req.user.id);
    if (!vendor) {
      req.flash('error', 'Satıcı tapılmadı!');
      return res.redirect('/vendor/dashboard');
    }
    if (req.user.role !== 'Vendor') {
      return res.redirect('/auth/logout');
    }
    const sales = await getSalesData(req.user.id);
    res.render('vendor/sales', {
      title: 'Satış Tarixçəsi',
      vendor,
      ...sales
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/vendor/dashboard');
  }
};

// Açıq (public) satıcı mağazası — /vendors/:vendorId
// Yalnız həmin satıcıya aid məhsulları göstərir (filtr/sıralama ilə).
exports.viewStore = async (req, res) => {
  try {
    const vendor = await Vendor.findBySlug(req.params.vendorId).catch(() => null) || await Vendor.findById(req.params.vendorId);
    if (!vendor) {
      return res.status(404).render('errors/404', { title: 'Mağaza tapılmadı' });
    }
    const viewer = res.locals.user;
    if ((vendor.status || 'ACTIVE') !== 'ACTIVE' && !(viewer && viewer.role === 'Admin')) {
      return res.status(404).render('errors/404', { title: 'Mağaza tapılmadı' });
    }

    const filtered = applyProductFilters(await Product.findByVendorId(vendor.user_id), req.query);
    let products = filtered.products;

    // Filter üçün mağazada mövcud olan kateqoriyalar
    const allVendorProducts = await Product.findByVendorId(vendor.user_id);
    const categories = [...new Set(allVendorProducts.map(p => p.category).filter(Boolean))];

    // Bütün real məhsul rəylərinin çəkili ortalaması satıcının ümumi reytinqidir.
    const totalReviews = allVendorProducts.reduce((sum, p) => sum + Number(p.reviews_count || 0), 0);
    const totalStars = allVendorProducts.reduce((sum, p) => sum + Number(p.rating || 0) * Number(p.reviews_count || 0), 0);
    const avgRating = totalReviews ? totalStars / totalReviews : 0;

    const wishlist = viewer ? await Wishlist.getWishlist(viewer.id) : [];
    products.forEach(p => { p.vendor_name = vendor.store_name; });

    // Phase 15 — mağazada ictimai göstərilən aktiv (bitməmiş) satıcı kuponları
    const now = new Date();
    const vendorCoupons = (await Coupon.findByVendorId(vendor.user_id).catch(() => []))
      .filter(c => !c.expiry_date || new Date(c.expiry_date) >= now);

    res.render('vendor/store', {
      title: vendor.store_name,
      vendor,
      products,
      query: filtered.query,
      categories,
      productCount: allVendorProducts.length,
      avgRating,
      totalReviews,
      vendorCoupons,
      wishlistIds: [...new Set(wishlist.map(w => w.product_id))]
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/');
  }
};

// Mağaza profili redaktə forması
exports.profileEdit = async (req, res) => {
  try {
    const vendor = await Vendor.findByUserId(req.user.id);
    if (!vendor) {
      req.flash('error', 'Satıcı tapılmadı!');
      return res.redirect('/vendor/dashboard');
    }
    res.render('vendor/profile', { title: 'Mağaza Profili', vendor });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/vendor/dashboard');
  }
};

// Satıcı məlumatlarını yenilə (logo/banner upload dəstəyi ilə)
exports.updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByUserId(req.user.id);
    if (!vendor) {
      req.flash('error', 'Satıcı tapılmadı!');
      return res.redirect('/vendor/dashboard');
    }
    const updateData = {
      store_name: req.body.store_name,
      store_description: req.body.store_description || null
    };
    if (req.files && req.files.store_logo && req.files.store_logo[0]) {
      updateData.store_logo = `/uploads/${req.files.store_logo[0].filename}`;
    }
    if (req.files && req.files.store_banner && req.files.store_banner[0]) {
      updateData.store_banner = `/uploads/${req.files.store_banner[0].filename}`;
    }
    await Vendor.update(vendor._id, updateData);
    req.flash('success', 'Mağaza profili yeniləndi!');
    res.redirect('/vendor/profile');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/vendor/profile');
  }
};

// ==== Satıcı kuponları (Vendor Dashboard-dan) ====
// Kupon YALNIZ bu satıcının məhsullarına şamil olunur (vendor_id = satıcının user_id-si,
// Product.vendor_id ilə eyni açar — pricingService.calculateDiscount bununla müqayisə edir).

// Kuponlarım siyahısı
exports.listCoupons = async (req, res) => {
  try {
    const vendor = await Vendor.findByUserId(req.user.id);
    if (!vendor) {
      req.flash('error', 'Satıcı tapılmadı!');
      return res.redirect('/vendor/dashboard');
    }
    const coupons = await Coupon.findByVendorId(req.user.id);
    res.render('vendor/coupons', { title: 'Kuponlarım', vendor, coupons });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/vendor/dashboard');
  }
};

// Yeni satıcı kuponu yarat (yalnız öz mağazasına aid, sahiblik backend-də təyin olunur)
exports.createCoupon = async (req, res) => {
  try {
    const vendor = await Vendor.findByUserId(req.user.id);
    if (!vendor) {
      req.flash('error', 'Satıcı tapılmadı!');
      return res.redirect('/vendor/dashboard');
    }
    const { code, discount_type, discount_value, usage_limit, min_order_value, expiry_date } = req.body;
    if (!code || !discount_type) {
      req.flash('error', 'Kupon kodu, tipi və dəyəri tələb olunur!');
      return res.redirect('/vendor/coupons');
    }
    await Coupon.create({
      code,
      discount_type,
      discount_value,
      usage_limit,
      min_order_value,
      expiry_date,
      vendor_id: req.user.id // yalnız öz mağazası — heç vaxt body-dən götürülmür
    });
    req.flash('success', 'Kupon uğurla yaradıldı!');
    res.redirect('/vendor/coupons');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/vendor/coupons');
  }
};

// Satıcı öz kuponunu silə bilər (başqa satıcının/qlobal kuponunu silə bilməz)
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon || coupon.vendor_id !== req.user.id) {
      req.flash('error', 'Kupon tapılmadı və ya icazəniz yoxdur!');
      return res.redirect('/vendor/coupons');
    }
    await Coupon.delete(coupon._id);
    req.flash('success', 'Kupon silindi!');
    res.redirect('/vendor/coupons');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/vendor/coupons');
  }
};

// ==========================================================
// Phase 14 — Dəstək sistemi (Vendor Dashboard → Support)
// ==========================================================
exports.getSupport = async (req, res) => {
  try {
    const vendor = await Vendor.findByUserId(req.user.id);
    if (!vendor) {
      req.flash('error', 'Satıcı tapılmadı!');
      return res.redirect('/vendor/dashboard');
    }
    const tickets = await Ticket.findByUserId(req.user.id);
    res.render('vendor/support', {
      title: 'Dəstək',
      vendor,
      tickets,
      ticketCategories: Ticket.CATEGORIES
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/vendor/dashboard');
  }
};

// Müştərilərin birbaşa mağazaya göndərdiyi şəxsi mesajlar (admin dəstəyindən ayrıdır).
exports.getCustomerSupport = async (req, res) => {
  try {
    const vendor = await Vendor.findByUserId(req.user.id);
    if (!vendor) {
      req.flash('error', 'Satıcı tapılmadı!');
      return res.redirect('/vendor/dashboard');
    }
    const conversations = await Ticket.findVendorConversations(req.user.id);
    const customerIds = [...new Set(conversations.map(item => item.user_id))];
    const customers = await Promise.all(customerIds.map(id => User.findById(id).catch(() => null)));
    const customerMap = new Map(customers.filter(Boolean).map(customer => [customer._id, customer]));
    res.render('vendor/customer-support', {
      title: 'Müştəri mesajları',
      vendor,
      conversations: conversations.map(item => ({ ...item, customer: customerMap.get(item.user_id) || null }))
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/vendor/dashboard');
  }
};

// ==========================================================
// Phase 13.5 — Vendor Product Q&A idarəetməsi (öz məhsulları üzrə)
// ==========================================================
exports.getQuestions = async (req, res) => {
  try {
    const vendor = await Vendor.findByUserId(req.user.id);
    if (!vendor) {
      req.flash('error', 'Satıcı tapılmadı!');
      return res.redirect('/vendor/dashboard');
    }
    let questions = await Question.findByVendorId(req.user.id);
    const products = await Product.findByVendorId(req.user.id).catch(() => []);
    const productMap = new Map(products.map(p => [p._id, p]));
    const userIds = [...new Set(questions.map(q => q.user_id))];
    const users = await Promise.all(userIds.map(id => User.findById(id).catch(() => null)));
    const userMap = new Map(users.filter(Boolean).map(u => [u._id, u]));

    const { status } = req.query;
    if (status) questions = questions.filter(q => q.status === status);

    questions = questions.map(q => ({
      ...q,
      product_name: (productMap.get(q.product_id) || {}).name || 'Silinmiş məhsul',
      customer_name: (userMap.get(q.user_id) || {}).full_name || 'Silinmiş istifadəçi'
    }));

    res.render('vendor/questions', {
      title: 'Məhsul Sualları',
      vendor,
      questions,
      filters: { status: status || '' }
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/vendor/dashboard');
  }
};

// Vendor məhsul sualına cavab verir (sual bütün vendorlar üçün görünür)
exports.answerQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      req.flash('error', 'Sual tapılmadı!');
      return res.redirect('/vendor/questions');
    }
    const text = (req.body.answerText || '').trim();
    if (!text) {
      req.flash('error', 'Cavab mətni boş ola bilməz!');
      return res.redirect('/vendor/questions');
    }
    await Question.answer(question._id, text, 'Vendor');
    await Notification.create({ recipientUserId: question.user_id, recipientRole: 'Customer', type: 'PRODUCT_QUESTION_ANSWERED', contextKey: 'questions', title: 'Sualınız cavablandı', message: text, targetRoute: '/user/profile?tab=questions', targetEntityId: question._id });
    req.flash('success', 'Cavabınız göndərildi və məhsul səhifəsində göstəriləcək!');
    res.redirect('/vendor/questions');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/vendor/questions');
  }
};

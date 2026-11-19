const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const jwtConfig = require('./config/jwt');

// Marşrutlar
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const vendorStoreRoutes = require('./routes/vendorStoreRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const questionRoutes = require('./routes/questionRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const adminRoutes = require('./routes/adminRoutes');
const walletRoutes = require('./routes/walletRoutes');
const langRoutes = require('./routes/langRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const debugRoutes = require('./routes/debugRoutes');
const { i18nMiddleware } = require('./middlewares/i18nMiddleware');
const Product = require('./models/Product');
const Cart = require('./models/Cart');
const Wishlist = require('./models/Wishlist');
const Wallet = require('./models/Wallet');
const SavedCard = require('./models/SavedCard');
const Coupon = require('./models/Coupon');
const Address = require('./models/Address');
const Vendor = require('./models/Vendor');
const User = require('./models/User');
const Notification = require('./models/Notification');
const { calculateDiscount } = require('./services/pricingService');
const orderController = require('./controllers/orderController');
const { authenticate, authorize } = require('./middlewares/authMiddleware');
const { requireCurrentAuthVersion } = require('./middlewares/sessionMiddleware');
const { startAutomationLoop } = require('./services/orderAutomationService');
const { getFeaturedVendors } = require('./services/vendorDirectoryService');
const { portalForHostname } = require('./services/authPortal');
const { tokenForRequest, clearAuthCookies } = require('./services/authSession');
const { formatMoney, roundMoney } = require('./services/money');
const { sessionSecret } = require('./config/security');

const app = express();
app.set('trust proxy', 1);

// Middleware-lər
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Session konfiqurasiyası
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 } // 24 saat
}));

// Flash mesajlar
app.use(flash());

// Çoxdilli sistem (i18n) - res.locals.t() və res.locals.currentLang hər EJS səhifəsində əlçatandır
app.use(i18nMiddleware);

// Bütün EJS səhifələri üçün təhlükəsiz default dəyişənlər
app.use(async (req, res, next) => {
  res.locals.user = null;
  res.locals.cartCount = 0;
  res.locals.wishlistCount = 0;
  res.locals.walletBalance = 0;
  res.locals.notificationUnreadCount = 0;
  res.locals.notificationContextCounts = {};
  res.locals.currentUrl = req.originalUrl;
  res.locals.money = formatMoney;
  res.locals.authPortal = portalForHostname(req.hostname);
  res.locals.authPaths = { login: '/auth/login', register: res.locals.authPortal === 'Admin' ? null : '/auth/register' };
  res.locals.messages = {
    error: req.flash('error'),
    success: req.flash('success')
  };

  const token = tokenForRequest(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, jwtConfig.secret);
      const currentUser = await User.findById(decoded.id);
      if (!currentUser || currentUser.isActive === false) throw new Error('İstifadəçi aktiv deyil');
      res.locals.user = { ...currentUser, id: currentUser._id };
      const contextByRoute = res.locals.user.role === 'Admin'
        ? { '/admin/questions': 'questions', '/admin/support': 'support', '/admin/refunds': 'returns', '/admin/vendors': 'vendors', '/admin/payments': 'payments', '/admin/orders': 'orders' }
        : res.locals.user.role === 'Vendor'
          ? { '/vendor/questions': 'questions', '/vendor/customer-support': 'customer_support', '/vendor/support': 'support', '/vendor/sales': 'orders' }
          : { '/orders': 'orders' };
      let openedContext = Object.entries(contextByRoute).find(([route]) => req.path.startsWith(route));
      if (res.locals.user.role === 'Vendor' && req.path === '/vendor/sales' && req.query.context === 'returns') openedContext = [req.path, 'returns'];
      if (res.locals.user.role === 'Customer' && req.path === '/user/profile') {
        const tab = String(req.query.tab || '');
        if (['questions', 'support', 'refunds'].includes(tab)) openedContext = [req.path, tab === 'refunds' ? 'returns' : tab];
      }
      if (res.locals.user.role === 'Customer' && req.path.startsWith('/vendors/') && req.path.endsWith('/contact')) openedContext = [req.path, 'vendor_support'];
      if (openedContext) await Notification.markContextRead(res.locals.user.id, openedContext[1]).catch(() => null);
      const cartItems = await Cart.getCart(res.locals.user.id).catch(() => []);
      res.locals.cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      const wishlistItems = await Wishlist.getWishlist(res.locals.user.id).catch(() => []);
      res.locals.wishlistCount = wishlistItems.length;
      const wallet = await Wallet.findByUserId(res.locals.user.id).catch(() => null);
      res.locals.walletBalance = wallet ? Number(wallet.balance) : 0;
      res.locals.notificationUnreadCount = await Notification.countUnread(res.locals.user.id).catch(() => 0);
      res.locals.notificationContextCounts = await Notification.unreadCountsByContext(res.locals.user.id).catch(() => ({}));
    } catch (err) {
      clearAuthCookies(res);
    }
  }
  next();
});

// EJS şablon mühərriki
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Marşrutlar
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/vendor', vendorRoutes);
app.use('/vendors', vendorStoreRoutes);
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);
app.use('/orders', orderRoutes);
app.use('/reviews', reviewRoutes);
app.use('/questions', questionRoutes);
app.use('/support', ticketRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/admin', adminRoutes);
app.use('/wallet', walletRoutes);
app.use('/lang', langRoutes);
app.use('/notifications', notificationRoutes);
app.use('/receipts', receiptRoutes);
app.use('/debug', debugRoutes);

// Ana səhifə
app.get('/', async (req, res) => {
  const allProducts = await Product.findAll().catch(() => []);
  const allVendors = await Vendor.findAll().catch(() => []);
  const vendorMap = new Map(allVendors.map(v => [v.user_id, v]));
  // Suspend edilmiş satıcıların məhsulları ana səhifədə göstərilmir
  const suspendedVendorIds = new Set(allVendors.filter(v => (v.status || 'ACTIVE') === 'SUSPENDED').map(v => v.user_id));
  const featured = allProducts
    .filter(p => !suspendedVendorIds.has(p.vendor_id))
    .map(p => {
      const vendor = vendorMap.get(p.vendor_id);
      return vendor ? { ...p, vendor_name: vendor.store_name } : p;
    });

  const featuredVendors = await getFeaturedVendors(8).catch(() => []);

  res.render('index', { title: 'ShopNexus', featured, featuredVendors });
});

app.get('/checkout', authenticate, requireCurrentAuthVersion, authorize(['Customer']), async (req, res) => {
  try {
    const savedCards = await SavedCard.findByUserId(req.user.id).catch(() => []);
    const wallet = await Wallet.findByUserId(req.user.id).catch(() => null);
    const addresses = await Address.findByUserId(req.user.id).catch(() => []);
    const walletBalance = wallet ? Number(wallet.balance) : 0;
    const cartItems = await Cart.getCart(req.user.id).catch(() => []);
    let subtotal = 0;
    const lines = [];
    for (const item of cartItems) {
      const product = await Product.findById(item.product_id).catch(() => null);
      if (product) {
        subtotal = roundMoney(subtotal + Number(product.price) * Number(item.quantity));
        lines.push({ price: Number(product.price), quantity: Number(item.quantity), vendor_id: product.vendor_id });
      }
    }

    // Tətbiq olunmuş kupon endirimi (server-side authoritative total, satıcı kuponları yalnız həmin satıcının sətirlərinə tətbiq olunur)
    let discount = 0;
    const couponCode = req.session.couponCode || null;
    if (couponCode) {
      const coupon = await Coupon.findByCode(couponCode).catch(() => null);
      if (coupon) {
        const result = calculateDiscount(coupon, lines);
        if (!result.error) discount = result.discount;
      }
    }
    const cartTotal = roundMoney(subtotal - discount);

    res.render('cart/checkout', { title: 'Checkout', savedCards, addresses, walletBalance, cartTotal, subtotal, discount });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/cart');
  }
});
app.post('/checkout', authenticate, requireCurrentAuthVersion, authorize(['Customer']), orderController.initiateCheckout);
app.get('/checkout/otp', authenticate, requireCurrentAuthVersion, authorize(['Customer']), orderController.showOtp);
app.post('/checkout/otp', authenticate, requireCurrentAuthVersion, authorize(['Customer']), orderController.verifyOtp);
app.get('/orders/:id/receipt', authenticate, requireCurrentAuthVersion, authorize(['Customer']), orderController.getReceipt);

// 404 handler
app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Səhifə tapılmadı' });
});

// Qlobal xəta handler-i: malformed JSON və digər gözlənilməz xətalar
// üçün generic cavab qaytarır (fayl yolu / stack trace açıqlanmır).
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err.status === 400 || (err.status >= 400 && err.status < 500))) {
    return res.status(400).json({ error: 'Yanlış sorğu formatı.' });
  }
  console.error('[GlobalError]', err);
  return res.status(500).json({ error: 'Daxili server xətası.' });
});

// Serveri işə sal
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda işə salındı!`);
    startAutomationLoop(2000);
  });
}

module.exports = app;

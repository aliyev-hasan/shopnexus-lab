const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const upload = require('../config/multer');
const ticketController = require('../controllers/ticketController');

// Vendor onboarding
router.get('/onboarding', authenticate, vendorController.onboarding);
router.post('/onboarding', authenticate, vendorController.onboardVendor);

// Satıcı paneli (Customer onboarding görə bilsin deyə yalnız authenticate)
router.get('/dashboard', authenticate, vendorController.getVendor);

// Satış tarixçəsi
router.get('/sales', authenticate, authorize(['Vendor']), vendorController.getSales);

// Mağaza profili redaktə forması
router.get('/profile', authenticate, authorize(['Vendor']), vendorController.profileEdit);

// Dəstək (Phase 14)
router.get('/support', authenticate, authorize(['Vendor']), vendorController.getSupport);
router.get('/customer-support', authenticate, authorize(['Vendor']), vendorController.getCustomerSupport);
router.post('/customer-support/:id/reply', authenticate, authorize(['Vendor']), ticketController.replyVendorConversation);

// Məhsul Sualları (Phase 13.5 — vendor öz məhsullarına aid sualları cavablandırır)
router.get('/questions', authenticate, authorize(['Vendor']), vendorController.getQuestions);
router.post('/questions/:id/answer', authenticate, authorize(['Vendor']), vendorController.answerQuestion);

// Mağaza profili yenilə (logo/banner upload)
router.post('/profile', authenticate, authorize(['Vendor']), upload.fields([
  { name: 'store_logo', maxCount: 1 },
  { name: 'store_banner', maxCount: 1 }
]), vendorController.updateVendor);

// Kuponlarım (yalnız öz mağazasına aid kuponlar)
router.get('/coupons', authenticate, authorize(['Vendor']), vendorController.listCoupons);
router.post('/coupons', authenticate, authorize(['Vendor']), vendorController.createCoupon);
router.post('/coupons/:id/delete', authenticate, authorize(['Vendor']), vendorController.deleteCoupon);

// Məhsul siyahısı
router.get('/products', authenticate, authorize(['Vendor']), productController.getVendorProducts);

// Yeni məhsul əlavə et
router.post('/products', authenticate, authorize(['Vendor']), upload.single('image'), productController.createProduct);

// Məhsul redaktə forması
router.get('/products/:id/edit', authenticate, authorize(['Vendor']), (req, res) => {
  const Product = require('../models/Product');
  Product.findById(req.params.id).then(product => {
    if (!product || product.vendor_id !== req.user.id) {
      return res.redirect('/vendor/dashboard');
    }
    res.render('vendor/edit-product', { title: 'Məhsulu Redaktə Et', product });
  }).catch(() => res.redirect('/vendor/dashboard'));
});

// Məhsulu yenilə (HTML form üçün POST)
router.post('/products/:id', authenticate, authorize(['Vendor']), upload.single('image'), productController.updateProduct);

// Məhsulu yenilə
router.put('/products/:id', authenticate, authorize(['Vendor']), upload.single('image'), productController.updateProduct);

// Məhsulu sil (HTML form üçün POST)
router.post('/products/:id/delete', authenticate, authorize(['Vendor']), productController.deleteProduct);

// Məhsulu sil
router.delete('/products/:id', authenticate, authorize(['Vendor']), productController.deleteProduct);

// Stok yenilə (HTML form üçün POST)
router.post('/products/:id/stock', authenticate, authorize(['Vendor']), productController.updateStock);

// Stok yenilə
router.put('/products/:id/stock', authenticate, authorize(['Vendor']), productController.updateStock);

module.exports = router;

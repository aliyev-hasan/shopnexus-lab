const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { requireCurrentAuthVersion } = require('../middlewares/sessionMiddleware');

// Səbət yalnız müştəri hesabları üçündür
const customerAuth = [authenticate, requireCurrentAuthVersion, authorize(['Customer'])];

// Səbəti göstər
router.get('/', customerAuth, cartController.getCart);

// Səbətə məhsul əlavə et
router.post('/add', customerAuth, cartController.addToCart);

// Səbətdən məhsulu çıxar
router.post('/remove', customerAuth, cartController.removeFromCart);

// Səbətdəki məhsulun miqdarını yenilə (HTML form üçün POST)
router.post('/update', customerAuth, cartController.updateQuantity);

// Səbətdəki məhsulun miqdarını yenilə
router.put('/update', customerAuth, cartController.updateQuantity);

// Kupon tətbiq et
router.post('/apply-coupon', customerAuth, cartController.applyCoupon);

module.exports = router;

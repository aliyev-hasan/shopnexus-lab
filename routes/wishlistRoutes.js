const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { requireCurrentAuthVersion } = require('../middlewares/sessionMiddleware');

// İstək siyahısı yalnız müştəri hesabları üçündür
const customerAuth = [authenticate, requireCurrentAuthVersion, authorize(['Customer'])];

// İstək siyahısını göstər
router.get('/', customerAuth, wishlistController.getWishlist);

// İstək siyahısına məhsul əlavə et
router.post('/add', customerAuth, wishlistController.addToWishlist);

// İstək siyahısından məhsulu çıxar
router.post('/remove', customerAuth, wishlistController.removeFromWishlist);

// İstək siyahısından səbətə köçür
router.post('/move-to-cart', customerAuth, wishlistController.moveToCart);

// Wishlist toggle (AJAX)
router.post('/toggle', customerAuth, wishlistController.toggle);

module.exports = router;

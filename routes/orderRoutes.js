const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { requireCurrentAuthVersion } = require('../middlewares/sessionMiddleware');

// Sifarişlər yalnız müştəri hesabları üçündür (admin /admin/orders, vendor /vendor/sales istifadə edir)
const customerAuth = [authenticate, requireCurrentAuthVersion, authorize(['Customer'])];

// Sifarişləri göstər
router.get('/', customerAuth, orderController.getOrders);

// Sifariş axtarışı (filtr body/query-dən gəlir)
router.post('/search', customerAuth, orderController.searchCustomerOrders);
router.get('/search', customerAuth, orderController.searchCustomerOrders);

// Yeni sifariş yarat
router.post('/', customerAuth, orderController.createOrder);

// Sifariş detalları
router.get('/:id', customerAuth, orderController.getOrderById);

// Sifarişi ləğv et
router.post('/:id/cancel', customerAuth, orderController.cancelOrder);

// Geri qaytarma tələbi
router.post('/:id/refund', customerAuth, orderController.requestRefund);

module.exports = router;

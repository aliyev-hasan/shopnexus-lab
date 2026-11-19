const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const adminController = require('../controllers/adminController');

router.use(authenticate, authorize(['Admin']));

// Admin dashboard
router.get('/', adminController.dashboard);

// Sistem konfiqurasiyası
router.get('/system', adminController.systemConfig);

// İstifadəçilər
router.get('/users', adminController.listUsers);
router.post('/users', adminController.createUser);
router.post('/users/:id/role', adminController.updateUserRole);
router.post('/users/:id/toggle-active', adminController.toggleUserActive);
router.post('/users/:id/reset-password', adminController.resetUserPassword);

// Satıcılar (Users-dən ayrı, dedicated bölmə)
router.get('/vendors', adminController.listVendors);
router.get('/vendors/:id', adminController.vendorDetail);
router.post('/vendors/:id/toggle-status', adminController.toggleVendorStatus);
router.post('/vendors/:id/toggle-featured', adminController.toggleVendorFeatured);

// Məhsullar
router.get('/products', adminController.listProducts);
router.get('/products/:id/edit', adminController.editProduct);
router.post('/products/:id', adminController.updateProduct);
router.post('/products/:id/delete', adminController.deleteProduct);

// Kateqoriyalar
router.get('/categories', adminController.listCategories);
router.post('/categories', adminController.createCategory);
router.post('/categories/:id', adminController.updateCategory);
router.post('/categories/:id/delete', adminController.deleteCategory);

// Kuponlar
router.get('/coupons', adminController.listCoupons);
router.post('/coupons', adminController.createCoupon);
router.post('/coupons/:id', adminController.updateCoupon);
router.post('/coupons/:id/delete', adminController.deleteCoupon);

// Sifarişlər
router.get('/orders', adminController.listOrders);
router.post('/orders/:id/status', adminController.updateOrderStatus);

// Ödəniş simulyatoru
router.get('/payments', adminController.paymentSimulatorPage);
router.post('/payments/simulator', adminController.updatePaymentSimulator);

// Tənzimləmələr
router.get('/settings', adminController.settingsPage);
router.post('/settings/commission', adminController.updateCommission);
router.post('/settings/cashback', adminController.updateCashback);
router.post('/settings/order-automation', adminController.updateOrderAutomation);

// Maliyyə Mərkəzi
router.get('/finance', adminController.financePage);

// Gift Card-lar
router.get('/giftcards', adminController.listGiftCards);
router.post('/giftcards', adminController.createGiftCard);
router.post('/giftcards/:id/delete', adminController.deleteGiftCard);

// Məhsul sualları (Phase 13 — Q&A moderasiyası)
router.get('/questions', adminController.listQuestions);
router.post('/questions/:id/answer', adminController.answerQuestion);
router.post('/questions/:id/handle', adminController.markQuestionHandled);
router.post('/questions/:id/toggle-visibility', adminController.toggleQuestionVisibility);

// Dəstək Mərkəzi (Phase 14)
router.get('/support', adminController.listTickets);
router.post('/support/:id/reply', adminController.replyTicket);
router.post('/support/:id/close', adminController.closeTicket);
router.post('/support/:id/reopen', adminController.reopenTicket);

// Geri qaytarmalar
router.get('/refunds', adminController.listRefunds);
router.post('/refunds/:id/approve', adminController.approveRefund);
router.post('/refunds/:id/reject', adminController.rejectRefund);

module.exports = router;

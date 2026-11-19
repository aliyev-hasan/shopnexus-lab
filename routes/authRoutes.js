const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');
const { authPortal } = require('../services/authPortal');

// Qeydiyyat
router.get('/register', authPortal(), authController.showRegister);
router.post('/register', authPortal(), authController.register);

// Giriş
router.get('/login', authPortal(), authController.showLogin);
router.post('/login', authPortal(), authController.login);

// Localhost fallback portalları. Production-da rol yalnız hostname-dən müəyyən edilir.
router.get('/vendor/login', authPortal('Vendor'), authController.showLogin);
router.post('/vendor/login', authPortal('Vendor'), authController.login);
router.get('/vendor/register', authPortal('Vendor'), authController.showRegister);
router.post('/vendor/register', authPortal('Vendor'), authController.register);
router.get('/admin/login', authPortal('Admin'), authController.showLogin);
router.post('/admin/login', authPortal('Admin'), authController.login);

// Çıxış
router.post('/logout', authController.logout);

// Şifrəni dəyiş
router.post('/change-password', authenticate, authController.changePassword);

module.exports = router;

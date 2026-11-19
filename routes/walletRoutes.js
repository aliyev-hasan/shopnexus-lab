const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { requireCurrentAuthVersion } = require('../middlewares/sessionMiddleware');

// Cüzdan yalnız müştəri hesabları üçündür
const customerAuth = [authenticate, requireCurrentAuthVersion, authorize(['Customer'])];

router.get('/', customerAuth, walletController.getWallet);
router.post('/topup', customerAuth, walletController.topUp);
router.post('/redeem-giftcard', customerAuth, walletController.redeemGiftCard);
router.post('/saved-card/:id/delete', customerAuth, walletController.deleteSavedCard);

module.exports = router;

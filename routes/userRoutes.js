const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { requireCurrentAuthVersion } = require('../middlewares/sessionMiddleware');
const upload = require('../config/multer');
const User = require('../models/User');

const userAuth = [authenticate, requireCurrentAuthVersion];
const customerAuth = [authenticate, requireCurrentAuthVersion, authorize(['Customer'])];

// Profil məlumatları
router.get('/profile', userAuth, userController.paymentCenter);

// Profil şəkli yüklə
router.post('/profile/picture', userAuth, (req, res, next) => {
  upload.single('profile_picture')(req, res, err => {
    if (err) {
      req.flash('error', err.code === 'LIMIT_FILE_SIZE' ? 'Profil şəkli maksimum 5 MB ola bilər.' : err.message);
      return res.redirect('/user/profile');
    }
    next();
  });
}, userController.uploadProfilePicture);
router.post('/profile/picture/delete', userAuth, userController.deleteProfilePicture);

// Profil məlumatlarını yenilə
router.post('/profile', userAuth, async (req, res) => {
  try {
    await User.updateProfile(req.user.id, req.body);
    req.flash('success', 'Profil yeniləndi!');
    res.redirect('/user/profile');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/user/profile');
  }
});

// Ünvan idarəetməsi (yalnız müştəri hesabları)
router.post('/address', customerAuth, userController.addAddress);
router.post('/address/:id', customerAuth, userController.updateAddress);
router.post('/address/:id/delete', customerAuth, userController.deleteAddress);
router.post('/address/:id/default', customerAuth, userController.setDefaultAddress);

module.exports = router;

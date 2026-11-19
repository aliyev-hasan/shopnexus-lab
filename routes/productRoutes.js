const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const upload = require('../config/multer');

// Bütün məhsulları göstər
router.get('/', productController.getAllProducts);

// Məhsul detalları
router.get('/:id', productController.getProduct);

// Yeni məhsul yarat (Yalnız satıcılar)
router.post('/', authenticate, authorize(['Vendor']), upload.single('image'), productController.createProduct);

// Məhsulu yenilə (Yalnız satıcılar)
router.put('/:id', authenticate, authorize(['Vendor']), productController.updateProduct);

// Məhsulu sil (Yalnız satıcılar)
router.delete('/:id', authenticate, authorize(['Vendor']), productController.deleteProduct);

module.exports = router;
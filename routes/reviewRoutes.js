const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

// Məhsula aid rəyləri göstər
router.get('/:productId', reviewController.getReviews);

// Yeni rəy yarat
router.post('/', authenticate, authorize(['Customer']), reviewController.createReview);

// Rəyi sil
router.delete('/:id', authenticate, reviewController.deleteReview);

// Rəyi sil (HTML form üçün POST)
router.post('/:id/delete', authenticate, reviewController.deleteReview);

// Rəyi yenilə
router.put('/:id', authenticate, reviewController.updateReview);

module.exports = router;

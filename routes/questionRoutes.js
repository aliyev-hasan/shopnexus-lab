const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

// Məhsul haqqında sual ver
router.post('/', authenticate, authorize(['Customer']), questionController.askQuestion);

// İstifadəçinin öz sualları
router.get('/mine', authenticate, questionController.getMyQuestions);
router.post('/:id/delete', authenticate, authorize(['Customer']), questionController.deleteMyQuestion);

module.exports = router;

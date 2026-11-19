const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

router.post('/vendor/:vendorId', authenticate, authorize(['Customer']), ticketController.createVendorMessage);
router.post('/vendor-conversations/:id/reply', authenticate, authorize(['Customer', 'Vendor']), ticketController.replyVendorConversation);

// Yeni dəstək müraciəti yarat (Customer və ya Vendor)
router.post('/', authenticate, authorize(['Customer', 'Vendor']), ticketController.createTicket);

// Bilet söhbətinə davam mesajı yaz
router.post('/:id/reply', authenticate, ticketController.replyTicket);

module.exports = router;

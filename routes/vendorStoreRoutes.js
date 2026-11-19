const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const ticketController = require('../controllers/ticketController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

// Açıq (public) satıcı mağaza səhifəsi — hər kəs baxa bilər
// GET /vendors and /vendors/:slug
router.get('/', vendorController.listDirectory);
router.get('/:vendorId/contact', authenticate, authorize(['Customer']), ticketController.showVendorContact);
router.get('/:vendorId', vendorController.viewStore);

module.exports = router;

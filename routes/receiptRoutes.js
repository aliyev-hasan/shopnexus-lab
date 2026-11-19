const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');

// Təhlükəsiz, təsadüfi 256-bit tokenlə məhdud read-only verification görünüşü.
router.get('/:token', receiptController.publicView);

module.exports = router;

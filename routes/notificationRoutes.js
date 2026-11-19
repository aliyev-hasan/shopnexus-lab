const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const { requireCurrentAuthVersion } = require('../middlewares/sessionMiddleware');
const notificationController = require('../controllers/notificationController');

const userAuth = [authenticate, requireCurrentAuthVersion];

router.get('/', userAuth, notificationController.index);
router.post('/read-all', userAuth, notificationController.markAllRead);
router.get('/:id/open', userAuth, notificationController.open);

module.exports = router;

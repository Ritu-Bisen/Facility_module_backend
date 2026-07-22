const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/short-expiry', authenticate, reportController.getShortExpiryReport);

module.exports = router;

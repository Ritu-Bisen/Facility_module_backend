const express = require('express');
const router = express.Router();
const captchaController = require('../controllers/captchaController');

// GET /api/auth/captcha - Generate a new CAPTCHA
router.get('/', captchaController.generateCaptcha);

module.exports = router;

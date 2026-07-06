const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// POST /api/auth/login/email - Login with email and password
router.post('/login/email', authController.loginWithEmail);

// POST /api/auth/login/phone - Login with phone number and password
router.post('/login/phone', authController.loginWithPhone);

// POST /api/auth/otp/send - Send OTP via SMS or Email
router.post('/otp/send', authController.sendOTP);

// POST /api/auth/otp/verify - Verify OTP and Login
router.post('/otp/verify', authController.verifyOTP);

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', authController.refreshToken);

// POST /api/auth/change-password - Change user password
router.post('/change-password', authenticate, authController.changePassword);

module.exports = router;

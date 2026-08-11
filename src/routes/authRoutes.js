const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { loginRateLimiter, otpRateLimiter } = require('../middleware/rateLimitMiddleware');
const { noCache } = require('../middleware/cacheMiddleware');
const captchaRoutes = require('./captchaRoutes');

// Apply no-cache headers to all auth endpoints
router.use(noCache);

// CAPTCHA endpoint
router.use('/captcha', captchaRoutes);

// POST /api/auth/login/email - Step 1: Login with email and password
router.post('/login/email', loginRateLimiter, authController.loginWithEmail);

// POST /api/auth/login/phone - Step 1: Login with phone number and password
router.post('/login/phone', loginRateLimiter, authController.loginWithPhone);

// POST /api/auth/login/mfa - Step 2: Verify MFA OTP and Login (CWE-308)
router.post('/login/mfa', loginRateLimiter, authController.verifyMfa);

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', authController.refreshToken);

// POST /api/auth/change-password - Change user password
router.post('/change-password', authenticate, authController.changePassword);

// POST /api/auth/logout - Logout user
router.post('/logout', authenticate, authController.logout);

module.exports = router;

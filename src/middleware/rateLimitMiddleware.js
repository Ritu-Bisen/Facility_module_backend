const rateLimit = require('express-rate-limit');

// Configurable window and thresholds with secure, production-tested defaults
const LOGIN_RATE_LIMIT_WINDOW_MS = (parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES, 10) || 5) * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX = parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 20;

const OTP_RATE_LIMIT_WINDOW_MS = (parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MINUTES, 10) || 5) * 60 * 1000;
const OTP_RATE_LIMIT_MAX = parseInt(process.env.OTP_RATE_LIMIT_MAX, 10) || 5;

const MFA_RATE_LIMIT_WINDOW_MS = (parseInt(process.env.MFA_RATE_LIMIT_WINDOW_MINUTES, 10) || 5) * 60 * 1000;
const MFA_RATE_LIMIT_MAX = parseInt(process.env.MFA_RATE_LIMIT_MAX, 10) || 10;

// Rate limiter for login endpoints (email/phone credentials + CAPTCHA)
// skipSuccessfulRequests: true ensures legitimate users logging in successfully
// do not deplete the quota for other users sharing the same NAT / public IP.
// Failed attempts (401/400) continue counting towards the limit.
const loginRateLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again after 5 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Rate limiter for OTP generation/send endpoint
const otpRateLimiter = rateLimit({
  windowMs: OTP_RATE_LIMIT_WINDOW_MS,
  max: OTP_RATE_LIMIT_MAX,
  message: {
    success: false,
    message: 'Too many OTP requests from this IP, please try again after 5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Dedicated rate limiter for MFA verification (Step 2)
// Separated from initial login so MFA attempts do not collide with Step 1 quota
const mfaRateLimiter = rateLimit({
  windowMs: MFA_RATE_LIMIT_WINDOW_MS,
  max: MFA_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many MFA verification attempts from this IP, please try again after 5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginRateLimiter,
  otpRateLimiter,
  mfaRateLimiter
};

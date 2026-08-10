const rateLimit = require('express-rate-limit');

// Rate limiter for login endpoints (e.g., max 5 requests per 5 minutes)
const loginRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 requests per `window` (here, per 5 minutes)
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again after 5 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Rate limiter for OTP endpoints
const otpRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Limit each IP to 3 requests per `window` (here, per 5 minutes)
  message: {
    success: false,
    message: 'Too many OTP requests from this IP, please try again after 5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginRateLimiter,
  otpRateLimiter
};

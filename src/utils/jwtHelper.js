const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '20m';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const JWT_MFA_SECRET = process.env.JWT_MFA_SECRET || 'default_mfa_secret';

/**
 * Generate an access token and a refresh token for the given payload.
 * @param {Object} payload - Data to encode (e.g. { userId, emailId, firstName, lastName })
 * @returns {{ accessToken: string, refreshToken: string }}
 */
function generateTokens(payload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
  return { accessToken, refreshToken };
}

/**
 * Generate a short-lived temp token for MFA verification.
 */
function generateTempMfaToken(payload) {
  // Enforce 5-minute expiration for MFA OTP entry
  return jwt.sign(payload, JWT_MFA_SECRET, { expiresIn: '5m' });
}

/**
 * Verify an access token.
 * @param {string} token
 * @returns {Object} decoded payload
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Verify a refresh token.
 * @param {string} token
 * @returns {Object} decoded payload
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

/**
 * Verify an MFA temp token.
 */
function verifyTempMfaToken(token) {
  return jwt.verify(token, JWT_MFA_SECRET);
}

module.exports = {
  generateTokens,
  generateTempMfaToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyTempMfaToken
};

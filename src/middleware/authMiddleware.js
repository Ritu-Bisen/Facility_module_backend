const { verifyAccessToken } = require('../utils/jwtHelper');
const logger = require('../utils/logger');
const authModel = require('../models/authModel');

/**
 * Middleware to authenticate requests using JWT.
 * Expects header: Authorization: Bearer <token>
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    
    // Enforce Single Session (CWE-287)
    const user = await authModel.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const activeSessionId = await authModel.getSessionId(decoded.userId);
    if (!activeSessionId) {
      return res.status(401).json({ success: false, message: 'Session expired or logged out. Please login again.' });
    }
    if (decoded.sessionId && activeSessionId !== decoded.sessionId) {
      return res.status(401).json({ success: false, message: 'Session expired because your account was logged in from another location.' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    logger.error('JWT verification failed: ' + error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired. Please refresh or login again.' });
    }

    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
}

module.exports = { authenticate };

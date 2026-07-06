const { verifyAccessToken } = require('../utils/jwtHelper');
const logger = require('../utils/logger');

/**
 * Middleware to authenticate requests using JWT.
 * Expects header: Authorization: Bearer <token>
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
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

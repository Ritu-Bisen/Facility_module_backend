const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  // Log the full stack trace securely on the server
  logger.error(`[Error] ${err.message}\nStack: ${err.stack}`);
  
  // Save error message on res.locals so logging middleware records it in USERS_LOGS
  res.locals.errorMessage = err.message || 'Internal Server Error';

  // Return a generic error message for 500s to prevent info leakage (CWE-209)
  const status = err.status || 500;
  const message = status === 500 ? 'An unexpected error occurred. Please try again later.' : err.message;

  res.status(status).json({
    success: false,
    message: message,
  });
}

module.exports = { errorHandler };

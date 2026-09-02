const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  // Log the full stack trace securely on the server
  logger.error(`[Error] ${err.message}\nStack: ${err.stack}`);
  
  // Save error message on res.locals so logging middleware records it in USERS_LOGS
  res.locals.errorMessage = err.message || 'Internal Server Error';

  // Determine HTTP status code
  const status = err.status || err.statusCode || (err.type === 'entity.parse.failed' ? 400 : 500);

  // Return a generic, sanitized error message to prevent info leakage (CWE-209)
  let message = 'An unexpected error occurred. Please try again later.';
  
  if (err instanceof URIError || status === 400) {
    message = 'Bad Request: Invalid URL format or parameters.';
  } else if (status < 500 && err.message) {
    // Ensure internal error strings (e.g. database errors ORA-xxx, stack traces, paths) are not leaked
    const isSensitive = /ORA-\d+|PG-\d+|at\s+[\w\.\/]+|Error:|\[HttpException\]|\/|\\/i.test(err.message);
    if (!isSensitive) {
      message = err.message;
    }
  }

  res.status(status).json({
    success: false,
    message: message,
  });
}

module.exports = { errorHandler };

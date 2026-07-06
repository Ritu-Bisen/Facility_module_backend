const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(err.message || 'Internal Server Error');
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
}

module.exports = { errorHandler };

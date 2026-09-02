const { containsScriptOrHtml, sanitizeString } = require('../utils/sanitizer');

/**
 * Middleware to inspect and sanitize request body, query, and params for script/HTML injection payloads.
 */
function sanitizeMiddleware(req, res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      for (const key of Object.keys(req.body)) {
        const val = req.body[key];
        if (typeof val === 'string' && containsScriptOrHtml(val)) {
          return res.status(400).json({
            success: false,
            message: `Invalid request: HTML/script tag injection payload detected in field '${key}'`
          });
        }
      }
    }

    if (req.query && typeof req.query === 'object') {
      for (const key of Object.keys(req.query)) {
        const val = req.query[key];
        if (typeof val === 'string' && containsScriptOrHtml(val)) {
          return res.status(400).json({
            success: false,
            message: `Invalid request: HTML/script tag injection payload detected in query parameter '${key}'`
          });
        }
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = sanitizeMiddleware;

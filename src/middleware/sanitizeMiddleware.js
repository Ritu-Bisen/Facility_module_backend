const { containsScriptOrHtml } = require('../utils/sanitizer');

// Maximum allowed string field lengths (CWE-20 Mitigation for Buffer Overflow / DoS)
const DEFAULT_MAX_FIELD_LENGTH = 2000;
const AUTH_MAX_FIELD_LENGTH = 500;

/**
 * Recursively inspects objects for length limits and script/HTML injection payloads.
 * @param {object} obj 
 * @param {string} location 
 * @param {number} maxLen 
 * @returns {string|null} Error message or null
 */
function checkObjectInputs(obj, location = 'body', maxLen = DEFAULT_MAX_FIELD_LENGTH) {
  if (!obj || typeof obj !== 'object') return null;

  for (const key of Object.keys(obj)) {
    const val = obj[key];

    if (typeof val === 'string') {
      // 1. Enforce Maximum Length Validation (CWE-20 Buffer Overflow Mitigation)
      if (val.length > maxLen) {
        return `Input length limit exceeded: Field '${key}' exceeds maximum allowed length of ${maxLen} characters`;
      }

      // 2. Enforce Script/HTML Injection Prevention
      if (containsScriptOrHtml(val)) {
        return `Invalid request: HTML/script tag injection payload detected in field '${key}'`;
      }
    } else if (typeof val === 'object' && val !== null) {
      const err = checkObjectInputs(val, `${location}.${key}`, maxLen);
      if (err) return err;
    }
  }

  return null;
}

/**
 * Middleware to inspect and sanitize request body, query, and params for script/HTML injection payloads
 * and enforce maximum field length restrictions (CWE-20 Buffer Overflow / DoS mitigation).
 */
function sanitizeMiddleware(req, res, next) {
  try {
    const isAuthRoute = req.originalUrl && req.originalUrl.includes('/api/auth');
    const maxLen = isAuthRoute ? AUTH_MAX_FIELD_LENGTH : DEFAULT_MAX_FIELD_LENGTH;

    if (req.body && typeof req.body === 'object') {
      const err = checkObjectInputs(req.body, 'body', maxLen);
      if (err) {
        return res.status(400).json({ success: false, message: err });
      }
    }

    if (req.query && typeof req.query === 'object') {
      const err = checkObjectInputs(req.query, 'query', maxLen);
      if (err) {
        return res.status(400).json({ success: false, message: err });
      }
    }

    if (req.params && typeof req.params === 'object') {
      const err = checkObjectInputs(req.params, 'params', maxLen);
      if (err) {
        return res.status(400).json({ success: false, message: err });
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = sanitizeMiddleware;

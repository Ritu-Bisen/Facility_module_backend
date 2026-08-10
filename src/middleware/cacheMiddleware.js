/**
 * Middleware to enforce strict Cache-Control headers for sensitive routes.
 * Mitigates CWE-525 (Web Browser Cache Containing Sensitive Information).
 */
function noCache(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}

module.exports = { noCache };

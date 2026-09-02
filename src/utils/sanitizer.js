/**
 * Input Sanitization and Validation Utilities (CWE-20 Mitigation)
 */

// Regex patterns for detecting script / HTML injection attempts
const SCRIPT_INJECTION_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const HTML_TAG_REGEX = /<[^>]*>/g;
const DANGEROUS_ATTRIBUTES_REGEX = /\b(on\w+|javascript:|data:|vbscript:)\s*=/gi;

/**
 * Checks if a string contains script tags or malicious HTML payload
 * @param {string} input 
 * @returns {boolean}
 */
function containsScriptOrHtml(input) {
  if (typeof input !== 'string') return false;
  return SCRIPT_INJECTION_REGEX.test(input) || 
         HTML_TAG_REGEX.test(input) || 
         DANGEROUS_ATTRIBUTES_REGEX.test(input);
}

/**
 * Sanitizes a string input by removing script tags, HTML tags, and dangerous attributes.
 * @param {string} input 
 * @returns {string}
 */
function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  let sanitized = input
    .replace(SCRIPT_INJECTION_REGEX, '')
    .replace(HTML_TAG_REGEX, '')
    .replace(DANGEROUS_ATTRIBUTES_REGEX, '');
  return sanitized.trim();
}

/**
 * Validates login identifier (Email, Phone Number, or Alphanumeric User ID)
 * @param {string} identifier 
 * @returns {{ valid: boolean, message?: string }}
 */
function validateIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return { valid: false, message: 'User ID / Phone Number / Email is required' };
  }
  
  if (containsScriptOrHtml(identifier)) {
    return { valid: false, message: 'Invalid characters or script payload detected in User ID / Phone field' };
  }

  const clean = identifier.trim();
  if (clean.length === 0 || clean.length > 100) {
    return { valid: false, message: 'User ID length must be between 1 and 100 characters' };
  }

  // Allowed characters: Alphanumeric, @, ., _, -, +
  const allowedPattern = /^[a-zA-Z0-9@._\-\+\s]+$/;
  if (!allowedPattern.test(clean)) {
    return { valid: false, message: 'User ID / Phone field contains disallowed characters' };
  }

  return { valid: true };
}

/**
 * Validates Ward Code and Ward Name
 * @param {string} wardCode 
 * @param {string} wardName 
 * @returns {{ valid: boolean, message?: string }}
 */
function validateWardInput(wardCode, wardName) {
  if (!wardCode || typeof wardCode !== 'string' || !wardCode.trim()) {
    return { valid: false, message: 'Ward Code is required' };
  }
  if (!wardName || typeof wardName !== 'string' || !wardName.trim()) {
    return { valid: false, message: 'Ward Name is required' };
  }

  if (containsScriptOrHtml(wardCode) || containsScriptOrHtml(wardName)) {
    return { valid: false, message: 'Ward Code or Ward Name contains invalid HTML/script tags' };
  }

  const cleanCode = wardCode.trim();
  const cleanName = wardName.trim();

  if (cleanCode.length > 50) {
    return { valid: false, message: 'Ward Code cannot exceed 50 characters' };
  }

  if (cleanName.length > 150) {
    return { valid: false, message: 'Ward Name cannot exceed 150 characters' };
  }

  // Allowed Ward Code: Alphanumeric, hyphen, underscore, slash, space
  const wardCodePattern = /^[a-zA-Z0-9_\-\/\s]+$/;
  if (!wardCodePattern.test(cleanCode)) {
    return { valid: false, message: 'Ward Code contains invalid characters' };
  }

  // Allowed Ward Name: Standard text (letters, numbers, spaces, common punctuation: . - _ / ( ) , &)
  const wardNamePattern = /^[a-zA-Z0-9\s._\-\/\(\),&]+$/;
  if (!wardNamePattern.test(cleanName)) {
    return { valid: false, message: 'Ward Name contains invalid characters or script payload' };
  }

  return { valid: true };
}

/**
 * Validates text name inputs like Special Location Name or Doctor Name
 * @param {string} name 
 * @param {string} fieldLabel 
 * @returns {{ valid: boolean, message?: string }}
 */
function validateNameInput(name, fieldLabel = 'Field') {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { valid: false, message: `${fieldLabel} is required` };
  }

  if (containsScriptOrHtml(name)) {
    return { valid: false, message: `${fieldLabel} contains invalid HTML/script tags` };
  }

  const clean = name.trim();
  if (clean.length > 200) {
    return { valid: false, message: `${fieldLabel} cannot exceed 200 characters` };
  }

  const namePattern = /^[a-zA-Z0-9\s._\-\/\(\),&]+$/;
  if (!namePattern.test(clean)) {
    return { valid: false, message: `${fieldLabel} contains invalid characters or script payload` };
  }

  return { valid: true };
}

/**
 * Validates 10-digit mobile phone number
 * @param {string} phone 
 * @returns {{ valid: boolean, message?: string }}
 */
function validatePhoneInput(phone) {
  if (!phone) return { valid: true }; // Optional if empty
  
  if (typeof phone !== 'string') {
    return { valid: false, message: 'Mobile number must be a string' };
  }

  const clean = phone.trim();
  if (clean === '') return { valid: true };

  const phonePattern = /^\d{10}$/;
  if (!phonePattern.test(clean)) {
    return { valid: false, message: 'Mobile Number must be exactly 10 digits' };
  }

  return { valid: true };
}

module.exports = {
  containsScriptOrHtml,
  sanitizeString,
  validateIdentifier,
  validateWardInput,
  validateNameInput,
  validatePhoneInput
};

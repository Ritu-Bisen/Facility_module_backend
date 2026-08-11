const svgCaptcha = require('svg-captcha');
const jwt = require('jsonwebtoken');

const CAPTCHA_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';

/**
 * Generate a new CAPTCHA and a signed token containing its text
 */
function generateCaptcha(req, res) {
  const captcha = svgCaptcha.create({
    size: 5,
    noise: 2,
    color: true,
    background: '#f8fafc'
  });

  // Sign the captcha text in a JWT that expires in 5 minutes
  const captchaToken = jwt.sign({ text: captcha.text.toLowerCase() }, CAPTCHA_SECRET, { expiresIn: '5m' });

  res.status(200).json({
    success: true,
    data: {
      image: captcha.data, // SVG string
      token: captchaToken
    }
  });
}

/**
 * Helper to verify captcha token
 */
function verifyCaptcha(token, value) {
  if (!token || !value) return false;
  try {
    const decoded = jwt.verify(token, CAPTCHA_SECRET);
    return decoded.text === value.toLowerCase();
  } catch (err) {
    return false;
  }
}

module.exports = {
  generateCaptcha,
  verifyCaptcha
};

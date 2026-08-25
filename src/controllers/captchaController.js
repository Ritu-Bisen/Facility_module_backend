const svgCaptcha = require('svg-captcha');
const jwt = require('jsonwebtoken');
const path = require('path');

// Load custom solid Comic Sans MS font to ensure characters are filled solid instead of hollow outline bubble letters
svgCaptcha.loadFont(path.join(__dirname, '../fonts/comic.ttf'));

const CAPTCHA_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';

/**
 * Generate a new CAPTCHA and a signed token containing its text
 */
function generateCaptcha(req, res) {
  const captcha = svgCaptcha.create({
    size: 5,
    noise: 2,
    color: true,
    background: '#ffffff',
    width: 220,
    height: 60,
    fontSize: 45
  });

  let captchaImg = captcha.data;
  // 1. Replace fixed width and height with 100% so it scales fluidly in the browser container and doesn't get clipped
  captchaImg = captchaImg.replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"');
  // 2. Change noise lines stroke to dark grey (initially only noise lines have stroke)
  captchaImg = captchaImg.replace(/stroke="[^"]+"/g, 'stroke="#555555"');
  // 3. Change text path fill and add stroke/stroke-width for bold text (target only <path fill=...)
  captchaImg = captchaImg.replace(/<path fill="(?!none)[^"]+"/g, '<path fill="#000000" stroke="#000000" stroke-width="1.5"');

  // Sign the captcha text in a JWT that expires in 5 minutes
  const captchaToken = jwt.sign({ text: captcha.text.toLowerCase() }, CAPTCHA_SECRET, { expiresIn: '5m' });

  res.status(200).json({
    success: true,
    data: {
      image: captchaImg, // Modified SVG string
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

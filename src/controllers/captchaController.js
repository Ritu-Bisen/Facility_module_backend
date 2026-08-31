const svgCaptcha = require('svg-captcha');
const jwt = require('jsonwebtoken');

const CAPTCHA_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';

/**
 * Generate a new CAPTCHA and a signed token containing its text
 */
function generateCaptcha(req, res) {
  try {
    const captcha = svgCaptcha.create({
      size: 5,
      noise: 2,
      color: true,
      background: '#ffffff',
      width: 250,
      height: 80,
      fontSize: 60,
      charPreset: '0123456789'
    });

    let captchaImg = captcha.data;
    captchaImg = captchaImg.replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"');
    captchaImg = captchaImg.replace(/stroke="[^"]+"/g, 'stroke="#555555"');
    captchaImg = captchaImg.replace(/<path fill="(?!none)[^"]+"/g, '<path fill="#000000" stroke="#000000" stroke-width="1.5"');

    const captchaToken = jwt.sign({ text: captcha.text.toLowerCase() }, CAPTCHA_SECRET, { expiresIn: '5m' });

    res.status(200).json({
      success: true,
      data: {
        image: captchaImg,
        token: captchaToken
      }
    });
  } catch (err) {
    console.error('CAPTCHA Generation Error:', err);
    // Fallback: Generate a simple 5-digit numeric CAPTCHA directly if svg-captcha fails
    const fallbackText = Math.floor(10000 + Math.random() * 90000).toString();
    const fallbackSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 250 80">
        <rect width="100%" height="100%" fill="#ffffff" />
        <path d="M10,40 Q125,0 240,40 T10,40" fill="none" stroke="#555555" stroke-width="2" />
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="50" font-family="monospace" font-weight="bold" fill="#000000">${fallbackText}</text>
      </svg>
    `;
    const fallbackToken = jwt.sign({ text: fallbackText }, CAPTCHA_SECRET, { expiresIn: '5m' });

    res.status(200).json({
      success: true,
      data: {
        image: fallbackSvg.trim(),
        token: fallbackToken
      }
    });
  }
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

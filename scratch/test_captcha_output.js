const svgCaptcha = require('svg-captcha');
const path = require('path');

console.log('Testing svg-captcha font loading...');
try {
  const fontPath = path.join(__dirname, '../src/fonts/comic.ttf');
  console.log('Font path:', fontPath);
  svgCaptcha.loadFont(fontPath);
  console.log('Font loaded successfully.');
} catch (err) {
  console.error('Error loading font:', err.message);
}

const captcha = svgCaptcha.create({
  size: 5,
  noise: 2,
  color: true,
  background: '#ffffff',
  width: 220,
  height: 60,
  fontSize: 45
});

console.log('\n--- RAW CAPTCHA SVG ---');
console.log(captcha.data.substring(0, 500));

let captchaImg = captcha.data;
captchaImg = captchaImg.replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"');
captchaImg = captchaImg.replace(/stroke="[^"]+"/g, 'stroke="#555555"');
captchaImg = captchaImg.replace(/<path fill="(?!none)[^"]+"/g, '<path fill="#000000" stroke="#000000" stroke-width="1.5"');

console.log('\n--- MODIFIED CAPTCHA SVG ---');
console.log(captchaImg.substring(0, 500));

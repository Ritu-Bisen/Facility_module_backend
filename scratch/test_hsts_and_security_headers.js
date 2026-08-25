const fs = require('fs');
const path = require('path');

function runHstsAndSecurityHeaderTest() {
  console.log('====================================================');
  console.log('  TESTING HSTS & SECURITY HEADERS CONFIGURATION');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${message}`);
    }
  }

  // 1. Check frontend web.config
  const frontendWebConfig = fs.readFileSync(path.join(__dirname, '../../frontend/web.config'), 'utf8');
  assert(frontendWebConfig.includes('<hsts enabled="true" max-age="31536000"'), 
    'Frontend web.config contains IIS native <hsts enabled="true" max-age="31536000"> tag.');
  assert(frontendWebConfig.includes('name="Strict-Transport-Security" value="max-age=31536000; includeSubDomains; preload"'), 
    'Frontend web.config enforces Strict-Transport-Security with max-age=31536000; includeSubDomains; preload.');

  // 2. Check public web.config
  const publicWebConfig = fs.readFileSync(path.join(__dirname, '../../frontend/public/web.config'), 'utf8');
  assert(publicWebConfig.includes('Strict-Transport-Security') && publicWebConfig.includes('max-age=31536000'), 
    'Frontend public/web.config enforces Strict-Transport-Security with positive max-age=31536000.');

  // 3. Check dist web.config
  const distWebConfig = fs.readFileSync(path.join(__dirname, '../../frontend/dist/web.config'), 'utf8');
  assert(distWebConfig.includes('Strict-Transport-Security') && distWebConfig.includes('max-age=31536000'), 
    'Frontend dist/web.config enforces Strict-Transport-Security with positive max-age=31536000.');

  // 4. Check backend app.js helmet config
  const backendAppJs = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  assert(backendAppJs.includes('maxAge: 31536000') && backendAppJs.includes('includeSubDomains: true'), 
    'Backend Node.js API helmet configuration enforces HSTS with maxAge: 31536000 and includeSubDomains.');

  console.log('\n====================================================');
  console.log(`  SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('====================================================');
}

runHstsAndSecurityHeaderTest();

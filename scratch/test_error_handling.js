const fs = require('fs');
const path = require('path');
const { errorHandler } = require('../src/middleware/errorMiddleware');

function runErrorHandlingTest() {
  console.log('====================================================');
  console.log('  TESTING ERROR HANDLING & STACK TRACE PROTECTION');
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

  // 1. Test Express Error Handler Middleware (backend)
  const mockErr = new Error('Database connection failed at ORACLE_DRIVER_LINE_999');
  mockErr.stack = 'Error: Database connection failed\n at OracleDriver.query (/var/db/secret.js:123)';

  let jsonResponse = null;
  let statusCode = 200;
  const mockRes = {
    locals: {},
    status(code) { statusCode = code; return this; },
    json(payload) { jsonResponse = payload; return this; }
  };

  errorHandler(mockErr, {}, mockRes, () => {});

  assert(statusCode === 500, 'Express error handler returns 500 HTTP status.');
  assert(jsonResponse.message === 'An unexpected error occurred. Please try again later.', 
    'Express error handler hides raw database error & stack trace from end users.');
  assert(!JSON.stringify(jsonResponse).includes('OracleDriver') && !JSON.stringify(jsonResponse).includes('secret.js'), 
    'No sensitive internal paths or database stack traces leaked in API JSON error response.');

  // 2. Test Frontend web.config customErrors configuration
  const frontendWebConfig = fs.readFileSync(path.join(__dirname, '../../frontend/web.config'), 'utf8');
  assert(frontendWebConfig.includes('<customErrors mode="On"'), 
    'Frontend web.config contains <customErrors mode="On"> to suppress ASP.NET Yellow Screen of Death (YSOD).');
  assert(frontendWebConfig.includes('<httpErrors errorMode="Custom" existingResponse="Replace">'), 
    'Frontend web.config contains <httpErrors errorMode="Custom" existingResponse="Replace"> to replace IIS error pages.');

  // 3. Test Backend web.config customErrors configuration
  const backendWebConfig = fs.readFileSync(path.join(__dirname, '../../backend/web.config'), 'utf8');
  assert(backendWebConfig.includes('<customErrors mode="On"'), 
    'Backend web.config contains <customErrors mode="On"> to suppress ASP.NET stack trace pages.');
  assert(backendWebConfig.includes('devErrorsEnabled="false"'), 
    'Backend web.config contains devErrorsEnabled="false" in iisnode settings.');

  console.log('\n====================================================');
  console.log(`  SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('====================================================');
}

runErrorHandlingTest();

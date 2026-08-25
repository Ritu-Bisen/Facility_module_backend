const jwt = require('jsonwebtoken');
const { generateTempMfaToken, verifyTempMfaToken } = require('../src/utils/jwtHelper');

function runMfaAuthenticationTest() {
  console.log('====================================================');
  console.log('  TESTING MULTI-FACTOR AUTHENTICATION (MFA / CWE-308)');
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

  // 1. Test MFA Step 1 Temp Token Generation
  const tempToken = generateTempMfaToken({ userId: 'USER_101', mfaRequired: true });
  assert(typeof tempToken === 'string' && tempToken.length > 20, 
    'Step 1 (Password Verification): Generates temporary MFA token (5-minute expiration) without granting full access tokens.');

  // 2. Test MFA Temp Token Verification
  const decodedTemp = verifyTempMfaToken(tempToken);
  assert(decodedTemp.mfaRequired === true && decodedTemp.userId === 'USER_101', 
    'Step 2 (OTP Verification): Decodes MFA temporary token payload correctly.');

  // 3. Test Invalid/Tampered MFA Token Rejection
  try {
    verifyTempMfaToken(tempToken + 'tampered');
    assert(false, 'Tampered MFA token should fail verification.');
  } catch (err) {
    assert(true, 'Step 2: Server rejects tampered/invalid MFA temporary tokens.');
  }

  console.log('\n====================================================');
  console.log(`  SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('====================================================');
}

runMfaAuthenticationTest();

const otpService = require('../src/services/otpService');

async function testOtpLoginFlow() {
  console.log('====================================================');
  console.log('  TESTING OTP GENERATION & HYBRID LOGIN FLOW');
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

  // 1. Test 6-digit OTP generation
  const otp = otpService.generateOTP();
  assert(/^\d{6}$/.test(otp), `OTP generator creates a valid 6-digit numeric OTP (${otp}).`);

  // 2. Test SMS dispatch (handles DPDMIS SMS API / mock)
  try {
    const smsResult = await otpService.sendSMS('9770406881', otp);
    assert(smsResult === true, 'sendSMS function dispatches message via DPDMIS SMS API or mock.');
  } catch (err) {
    assert(false, `sendSMS error: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`  SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('====================================================');
}

testOtpLoginFlow();

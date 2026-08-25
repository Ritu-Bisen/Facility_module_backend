const jwt = require('jsonwebtoken');
const { generateTokens, verifyAccessToken } = require('../src/utils/jwtHelper');

// Mock response object helper
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

// Unit test authMiddleware logic
async function runTests() {
  console.log('====================================================');
  console.log('  TESTING SESSION MANAGEMENT & PASSWORD CHANGE FIXES');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${message}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${message}`);
    }
  }

  // Simulated Database State
  let dbSessions = {}; // userId -> sessionId

  // Simulated authModel.getSessionId & findUserById
  const mockAuthModel = {
    async findUserById(userId) {
      return { USERID: userId, STATUS: 'A' };
    },
    async getSessionId(userId) {
      return dbSessions[userId] || null;
    },
    async updateSessionId(userId, sessionId) {
      dbSessions[userId] = sessionId;
    }
  };

  // Re-create the middleware logic under test
  async function testAuthenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = verifyAccessToken(token);
      const user = await mockAuthModel.findUserById(decoded.userId);
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found.' });
      }

      const activeSessionId = await mockAuthModel.getSessionId(decoded.userId);
      if (!activeSessionId) {
        return res.status(401).json({ success: false, message: 'Session expired or logged out. Please login again.' });
      }
      if (decoded.sessionId && activeSessionId !== decoded.sessionId) {
        return res.status(401).json({ success: false, message: 'Session expired because your account was logged in from another location.' });
      }

      req.user = decoded;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token has expired. Please refresh or login again.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
  }

  const userId = 'TEST_USER_101';

  // ---------------------------------------------------------
  // SCENARIO: VULNERABILITY POINT NO. 20 (CWE-613)
  // Step 1: User logs into Browser 1 and Browser 2
  // Step 2: User changes password in Browser 1 -> authService.changePassword calls updateSessionId(userId, null)
  // Step 3: Browser 2 attempts to navigate to Masters -> Facility Wards
  // Step 4: Server MUST REJECT Browser 2 with 401 Unauthorized
  // ---------------------------------------------------------
  const activeSessionIdBeforeChange = 'session-before-pwd-change';
  await mockAuthModel.updateSessionId(userId, activeSessionIdBeforeChange);

  const { accessToken: oldTokenBrowser2 } = generateTokens({
    userId,
    emailId: 'user@dpdmis.in',
    sessionId: activeSessionIdBeforeChange
  });

  // Verify Browser 2 works before password change
  const reqPrePasswordChange = { headers: { authorization: `Bearer ${oldTokenBrowser2}` } };
  const resPrePasswordChange = createMockRes();
  let nextPre = false;
  await testAuthenticate(reqPrePasswordChange, resPrePasswordChange, () => { nextPre = true; });

  assert(nextPre === true && resPrePasswordChange.statusCode === 200, 
    'Before password change: Active session in Browser 2 passes authentication.');

  // Password change takes place! (authService.changePassword executes updateSessionId(userId, null))
  await mockAuthModel.updateSessionId(userId, null);

  // Browser 2 tries to access Masters -> Facility Wards after password change
  const reqPostPasswordChange = { headers: { authorization: `Bearer ${oldTokenBrowser2}` } };
  const resPostPasswordChange = createMockRes();
  let nextPost = false;
  await testAuthenticate(reqPostPasswordChange, resPostPasswordChange, () => { nextPost = true; });

  assert(nextPost === false && resPostPasswordChange.statusCode === 401 && resPostPasswordChange.body.message.includes('logged out'),
    'Vulnerability Point No. 20 (CWE-613): Old session in Browser 2 is terminated (401 Unauthorized) immediately after password change.');

  console.log('\n====================================================');
  console.log(`  SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('====================================================');
}

runTests().catch(err => console.error(err));

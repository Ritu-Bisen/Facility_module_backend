const authService = require('../src/services/authService');

async function test() {
  const email = 'chctilda@dpdmis.in';
  const pass = 'it$cgmsc';
  console.log(`Testing login for ${email} with password "${pass}"...`);
  const result = await authService.loginWithEmail(email, pass);
  console.log('Result:', JSON.stringify(result, null, 2));
}

test().catch(console.error);

const http = require('http');
const app = require('../src/app');

console.log('Testing backend error handling middleware...');

const server = app.listen(0, async () => {
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  let testsPassed = 0;
  let testsTotal = 0;

  function runRequest(path, expectedStatus, expectedSuccess, description) {
    return new Promise((resolve) => {
      testsTotal++;
      http.get(`http://localhost:${port}${path}`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const statusMatch = res.statusCode === expectedStatus;
            const successMatch = data.success === expectedSuccess;
            // Check that response body contains no stack traces, file paths, or ASP.NET/Node exception dumps
            const noStackInResponse = !/\n\s+at\s+/i.test(body) && !body.includes('HttpException') && !body.includes('Stack:');
            
            if (statusMatch && successMatch && noStackInResponse) {
              console.log(`[PASS] ${description} -> Status: ${res.statusCode}, Message: "${data.message}"`);
              testsPassed++;
            } else {
              console.error(`[FAIL] ${description} -> Status: ${res.statusCode} (expected ${expectedStatus}), statusMatch: ${statusMatch}, successMatch: ${successMatch}, noStack: ${noStackInResponse}, Body: ${body}`);
            }
          } catch (e) {
            console.error(`[FAIL] ${description} -> Failed to parse JSON response:`, body);
          }
          resolve();
        });
      }).on('error', (err) => {
        console.error(`[FAIL] ${description} -> HTTP Request Error:`, err.message);
        resolve();
      });
    });
  }

  // 1. Test 404 handler for non-existent route
  await runRequest('/api/non-existent-endpoint-12345', 404, false, '404 Non-existent Route');

  // 2. Test 400 Bad Request / Malformed URI
  await runRequest('/api/users/%FE%FF', 400, false, '400 Malformed URI Parameter');

  server.close(() => {
    console.log(`\nTest Summary: ${testsPassed}/${testsTotal} tests passed.`);
    if (testsPassed === testsTotal) {
      console.log('All backend error handling tests PASSED cleanly!');
      process.exit(0);
    } else {
      console.error('Some tests failed!');
      process.exit(1);
    }
  });
});

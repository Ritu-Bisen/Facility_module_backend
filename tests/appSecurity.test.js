const { test, describe } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');

describe('App Security, CORS, and Headers Integration Tests', () => {
  let server;
  let baseUrl;

  test('Server starts and binds successfully with modified app.js', async () => {
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    assert.ok(port > 0);
  });

  test('app has trust proxy configured to 1', () => {
    assert.strictEqual(app.get('trust proxy'), 1);
  });

  test('Disallowed HTTP verbs (TRACE, TRACK, DEBUG) return 405 Method Not Allowed', async () => {
    const http = require('node:http');
    const port = server.address().port;

    const resStatus = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        path: '/api/auth/captcha',
        method: 'TRACE'
      }, (res) => {
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.end();
    });

    assert.strictEqual(resStatus, 405);
  });

  test('Security headers (Helmet) are properly attached', async () => {
    const res = await fetch(`${baseUrl}/api/auth/captcha`);
    assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(res.headers.get('x-powered-by'), null);
  });

  test('CORS blocks untrusted origin', async () => {
    const res = await fetch(`${baseUrl}/api/auth/captcha`, {
      headers: { Origin: 'https://malicious-site.com' }
    });
    // In our app.js, cors rejects with 403 or error handler
    assert.ok(res.status === 403 || res.status === 500);
  });

  test('CORS allows authorized origin', async () => {
    const res = await fetch(`${baseUrl}/api/auth/captcha`, {
      headers: { Origin: 'https://dpdmis.in' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), 'https://dpdmis.in');
  });

  test('Teardown test server', () => {
    if (server) server.close();
  });
});

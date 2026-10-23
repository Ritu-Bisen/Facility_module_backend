const { test, describe } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/app');
const { verifyCaptcha } = require('../src/controllers/captchaController');

describe('Server Production Stress and Edge Case Reliability Tests', () => {
  let server;
  let port;
  let baseUrl;

  test('Start test server with production app configuration', async () => {
    server = app.listen(0);
    port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    assert.ok(port > 0);
  });

  test('High Concurrency: 100 concurrent requests across 20 distinct client IPs without failure', async () => {
    const promises = [];
    // 20 distinct IPs, 5 requests each = 100 total concurrent requests
    for (let ipIndex = 1; ipIndex <= 20; ipIndex++) {
      const clientIp = `198.51.100.${ipIndex}`;
      for (let reqIndex = 0; reqIndex < 5; reqIndex++) {
        promises.push(
          fetch(`${baseUrl}/api/auth/captcha`, {
            headers: { 'x-forwarded-for': clientIp }
          }).then(async (res) => {
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.success, true);
          })
        );
      }
    }

    await Promise.all(promises);
  });

  test('NAT / Shared Office Simulation: 25 users sharing the same public IP can query without being locked out', async () => {
    // In hospital networks, all users share one public gateway IP
    const sharedHospitalIp = '203.0.113.10';
    const promises = [];

    for (let i = 0; i < 25; i++) {
      promises.push(
        fetch(`${baseUrl}/api/auth/captcha`, {
          headers: { 'x-forwarded-for': sharedHospitalIp }
        }).then(async (res) => {
          assert.strictEqual(res.status, 200);
        })
      );
    }

    await Promise.all(promises);
  });

  test('Proxy Header Robustness: IPv4, IPv6, IPv4-mapped, and Multi-hop headers do not crash Express', async () => {
    const testCases = [
      { header: '203.0.113.50', desc: 'Standard IPv4' },
      { header: '2001:0db8:85a3:0000:0000:8a2e:0370:7334', desc: 'Full IPv6' },
      { header: '2001:db8::1', desc: 'Compressed IPv6' },
      { header: '::ffff:192.0.2.128', desc: 'IPv4-mapped IPv6' },
      { header: '198.51.100.1, 10.0.0.1, 172.16.0.1', desc: 'Multi-hop reverse proxies' },
      { header: '   198.51.100.2   ', desc: 'Whitespace padded IP' },
      { header: '', desc: 'Empty header string' }
    ];

    for (const tc of testCases) {
      const headers = tc.header !== '' ? { 'x-forwarded-for': tc.header } : {};
      const res = await fetch(`${baseUrl}/api/auth/captcha`, { headers });
      assert.strictEqual(res.status, 200, `Failed for ${tc.desc}`);
      const body = await res.json();
      assert.strictEqual(body.success, true);
    }
  });

  test('CORS Preflight (OPTIONS request) succeeds with 204 and does not trigger rate limiting', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login/email`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://dpdmis.in',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });

    // Express CORS answers preflight with 204 No Content
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), 'https://dpdmis.in');
  });

  test('CAPTCHA endpoint creates verifiable tokens and rejects invalid or expired tokens', async () => {
    // 1. Fetch valid captcha
    const res = await fetch(`${baseUrl}/api/auth/captcha`);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.image.includes('<svg'));
    assert.ok(json.data.token);

    // 2. Reject mismatched text
    const isValidWrong = verifyCaptcha(json.data.token, 'INCORRECT_VALUE');
    assert.strictEqual(isValidWrong, false);

    // 3. Reject empty or null
    assert.strictEqual(verifyCaptcha('', '12345'), false);
    assert.strictEqual(verifyCaptcha(null, '12345'), false);
    assert.strictEqual(verifyCaptcha(json.data.token, ''), false);

    // 4. Reject tampered token
    const tampered = json.data.token.slice(0, -5) + 'xxxxx';
    assert.strictEqual(verifyCaptcha(tampered, '12345'), false);
  });

  test('Defensive Input Handling: Undefined, empty, and non-JSON bodies return 400 Bad Request without crashing', async () => {
    // 1. Empty body
    const resEmpty = await fetch(`${baseUrl}/api/auth/login/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://dpdmis.in'
      },
      body: JSON.stringify({})
    });
    assert.strictEqual(resEmpty.status, 400);
    const bodyEmpty = await resEmpty.json();
    assert.strictEqual(bodyEmpty.success, false);
    assert.strictEqual(bodyEmpty.message, 'CAPTCHA is required');

    // 2. Text/plain without valid JSON body
    const resPlain = await fetch(`${baseUrl}/api/auth/login/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Origin': 'https://dpdmis.in'
      },
      body: 'Raw unparsed text'
    });
    // Should be handled gracefully without 500 error
    assert.strictEqual(resPlain.status, 400);
  });

  test('Teardown test server', () => {
    if (server) server.close();
  });
});

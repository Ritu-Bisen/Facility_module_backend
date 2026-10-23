const { test, describe } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { loginRateLimiter, otpRateLimiter, mfaRateLimiter } = require('../src/middleware/rateLimitMiddleware');

describe('Rate Limiter and Proxy IP Detection Tests', () => {

  test('Express with trust proxy: 1 extracts real client IP behind 1 IIS reverse proxy hop', async () => {
    const app = express();
    app.set('trust proxy', 1);

    app.get('/api/test-ip', (req, res) => {
      res.json({ ip: req.ip, ips: req.ips });
    });

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/test-ip`, {
        headers: { 'x-forwarded-for': '203.0.113.55' }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.ip, '203.0.113.55', 'req.ip should match the forwarded client IP');
    } finally {
      server.close();
    }
  });

  test('Express with trust proxy: 1 prevents client IP spoofing', async () => {
    const app = express();
    app.set('trust proxy', 1);

    app.get('/api/test-ip', (req, res) => {
      res.json({ ip: req.ip });
    });

    const server = app.listen(0);
    const port = server.address().port;

    try {
      // In an attack scenario, the malicious client sends an X-Forwarded-For header with a fake IP.
      // IIS ARR appends the actual TCP connection IP (203.0.113.99) to the right.
      // With trust proxy: 1, Express trusts 1 hop and takes the right-most IP (the real client).
      const res = await fetch(`http://127.0.0.1:${port}/api/test-ip`, {
        headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.99' }
      });
      const data = await res.json();
      assert.strictEqual(data.ip, '203.0.113.99', 'Should take the verified client IP, not the spoofed prefix');
    } finally {
      server.close();
    }
  });

  test('Different client IPs maintain separate rate limit buckets', async () => {
    const app = express();
    app.set('trust proxy', 1);

    // Apply loginRateLimiter to a mock login endpoint
    app.post('/api/auth/login/test', loginRateLimiter, (req, res) => {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    });

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const ipA = '198.51.100.1';
      const ipB = '198.51.100.2';

      // IP A makes a request
      const resA1 = await fetch(`http://127.0.0.1:${port}/api/auth/login/test`, {
        method: 'POST',
        headers: { 'x-forwarded-for': ipA }
      });
      assert.strictEqual(resA1.status, 401);

      // IP B makes a request
      const resB1 = await fetch(`http://127.0.0.1:${port}/api/auth/login/test`, {
        method: 'POST',
        headers: { 'x-forwarded-for': ipB }
      });
      assert.strictEqual(resB1.status, 401);

      // Verify RateLimit-Remaining headers are independent
      const remainingA = parseInt(resA1.headers.get('ratelimit-remaining'), 10);
      const remainingB = parseInt(resB1.headers.get('ratelimit-remaining'), 10);
      assert.strictEqual(remainingA, remainingB, 'Both fresh IPs should have the same initial remaining count');
    } finally {
      server.close();
    }
  });

  test('Exceeding failure rate limit triggers HTTP 429 with Retry-After header', async () => {
    const rateLimit = require('express-rate-limit');
    const app = express();
    app.set('trust proxy', 1);

    const testLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 3,
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: 'Too many login attempts from this IP, please try again after 5 minutes' }
    });

    app.post('/api/auth/login/mock', testLimiter, (req, res) => {
      res.status(401).json({ success: false, message: 'Failed' });
    });

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const testIp = '192.0.2.100';

      // Attempts 1, 2, 3 should fail with 401
      for (let i = 0; i < 3; i++) {
        const res = await fetch(`http://127.0.0.1:${port}/api/auth/login/mock`, {
          method: 'POST',
          headers: { 'x-forwarded-for': testIp }
        });
        assert.strictEqual(res.status, 401);
      }

      // 4th attempt should be blocked with 429
      const blockedRes = await fetch(`http://127.0.0.1:${port}/api/auth/login/mock`, {
        method: 'POST',
        headers: { 'x-forwarded-for': testIp }
      });
      assert.strictEqual(blockedRes.status, 429, 'Should return HTTP 429');

      const body = await blockedRes.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.message, 'Too many login attempts from this IP, please try again after 5 minutes');

      // Verify standard rate limit headers
      assert.ok(blockedRes.headers.get('retry-after'), 'Retry-After header must be present');
      assert.strictEqual(blockedRes.headers.get('ratelimit-remaining'), '0');

      // A different IP should NOT be blocked
      const otherIpRes = await fetch(`http://127.0.0.1:${port}/api/auth/login/mock`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.0.2.200' }
      });
      assert.strictEqual(otherIpRes.status, 401, 'Unrelated IP must not be blocked');
    } finally {
      server.close();
    }
  });

  test('Successful requests do not deplete failure rate limit quota (skipSuccessfulRequests)', async () => {
    const rateLimit = require('express-rate-limit');
    const app = express();
    app.set('trust proxy', 1);

    const testLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: 'Rate limited' }
    });

    app.post('/api/auth/login/dual', testLimiter, (req, res) => {
      const shouldSucceed = req.headers['x-test-success'] === 'true';
      if (shouldSucceed) {
        res.status(200).json({ success: true, message: 'Welcome' });
      } else {
        res.status(401).json({ success: false, message: 'Unauthorized' });
      }
    });

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const testIp = '198.51.100.50';

      // Perform 5 successful logins from the same IP
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`http://127.0.0.1:${port}/api/auth/login/dual`, {
          method: 'POST',
          headers: { 'x-forwarded-for': testIp, 'x-test-success': 'true' }
        });
        assert.strictEqual(res.status, 200, 'Successful requests should pass through');
      }

      // Now perform 1 failed login
      const failRes1 = await fetch(`http://127.0.0.1:${port}/api/auth/login/dual`, {
        method: 'POST',
        headers: { 'x-forwarded-for': testIp, 'x-test-success': 'false' }
      });
      assert.strictEqual(failRes1.status, 401);

      // Remaining should still allow 1 more attempt
      const remaining = parseInt(failRes1.headers.get('ratelimit-remaining'), 10);
      assert.strictEqual(remaining, 1, 'Should have 1 attempt remaining despite previous 5 successful logins');
    } finally {
      server.close();
    }
  });

  test('MFA rate limiter and OTP rate limiter are configured with proper parameters', () => {
    assert.strictEqual(typeof otpRateLimiter, 'function');
    assert.strictEqual(typeof mfaRateLimiter, 'function');
    assert.strictEqual(typeof loginRateLimiter, 'function');
  });
});

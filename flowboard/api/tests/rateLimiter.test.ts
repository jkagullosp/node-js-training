/**
 * rateLimiter.test.ts
 *
 * Tests the rate limiting middleware in isolation using a mocked Redis client.
 * We mock '../src/lib/redis' so we can control what redis.incr() returns without
 * needing to fire 101 real HTTP requests.
 *
 * IMPORTANT: jest.mock() is hoisted above imports — the mock is in place before
 * the app module is evaluated, which means the rateLimiter middleware picks up
 * the mocked redis client on first import.
 */

// ── Mock the redis module ─────────────────────────────────────────────────
// The real module exports a named `redis` object. We replicate that shape here.
const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
  xadd: jest.fn(),
};

jest.mock('../src/lib/redis', () => ({
  redis: mockRedis,
}));

// ── Imports (after mock declaration) ─────────────────────────────────────
import request from 'supertest';
import { type Request, type Response } from 'express';
import { createApp } from '../src/app';
import { rateLimiter } from '../src/middleware/rateLimiter';

// MAX_REQUESTS from rateLimiter.ts — must match the source constant
const MAX_REQUESTS = 100;

const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();

  // Default stub: keep quit() from rejecting during cleanup
  mockRedis.quit.mockResolvedValue('OK');
  // ping() used by /ready
  mockRedis.ping.mockResolvedValue('PONG');
  // xadd() used by publishTaskEvent — succeed silently
  mockRedis.xadd.mockResolvedValue('0-1');
});

afterAll(async () => {
  // Prisma is not used in these tests — skip disconnect
  // Redis is mocked — quit() is a no-op here
});

// ---------------------------------------------------------------------------
// 429 — request limit exceeded
// ---------------------------------------------------------------------------
describe('Rate limiter — limit exceeded', () => {
  it('returns 429 when the request count exceeds MAX_REQUESTS', async () => {
    // Simulate a counter one above the limit
    mockRedis.incr.mockResolvedValue(MAX_REQUESTS + 1);
    mockRedis.expire.mockResolvedValue(1);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'x@flowboard.test', password: 'SomePass1!' });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('does not return 429 when the count equals MAX_REQUESTS exactly', async () => {
    // Count == MAX_REQUESTS is still within limit (only > triggers 429)
    mockRedis.incr.mockResolvedValue(MAX_REQUESTS);
    mockRedis.expire.mockResolvedValue(1);
    // Login will fail with 401 (wrong creds) — but NOT 429
    // Stub the auth path: get returns null (user not found), set is unused
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'x@flowboard.test', password: 'SomePass1!' });

    // Should be 401 (invalid credentials), not 429
    expect(res.status).not.toBe(429);
  });

  it('sets an expiry key on the first request in a window (count === 1)', async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');

    await request(app)
      .post('/auth/login')
      .send({ email: 'x@flowboard.test', password: 'SomePass1!' });

    expect(mockRedis.expire).toHaveBeenCalledTimes(1);
  });

  it('uses "unknown" as the rate-limit key when req.ip is undefined', async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    const mockNext = jest.fn();
    const mockReq = { ip: undefined, headers: {} } as unknown as Request;
    const mockRes = {} as Response;

    await rateLimiter(mockReq, mockRes, mockNext);

    expect(mockRedis.incr).toHaveBeenCalledWith('rate:unknown');
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('does not call expire again for subsequent requests in the same window', async () => {
    mockRedis.incr.mockResolvedValue(5); // not the first request
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');

    await request(app)
      .post('/auth/login')
      .send({ email: 'x@flowboard.test', password: 'SomePass1!' });

    expect(mockRedis.expire).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Fail-open — Redis error should not block traffic
// ---------------------------------------------------------------------------
describe('Rate limiter — fail-open on Redis error', () => {
  it('passes the request through when Redis throws (fail-open)', async () => {
    // Simulate Redis being unavailable
    mockRedis.incr.mockRejectedValue(new Error('Redis connection refused'));
    // Stub auth path to get a predictable response
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'x@flowboard.test', password: 'SomePass1!' });

    // The rate limiter must NOT return 429 or 500 — it should fail open.
    // The auth route will return 401 (wrong credentials) since no user exists.
    expect(res.status).not.toBe(429);
    expect(res.status).not.toBe(500);
    // Specifically: 401 because credentials are wrong, not a limiter error
    expect(res.status).toBe(401);
  });
});

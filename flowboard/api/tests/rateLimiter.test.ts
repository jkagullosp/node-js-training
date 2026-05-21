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

// ── Mock Prisma ───────────────────────────────────────────────────────────
// This is a unit test for the rate-limiter middleware, not an integration test.
// Prisma must be mocked so requests that pass the rate limiter do not attempt
// a real DB connection and return unpredictable 5xx responses.
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('../src/lib/prisma', () => ({
  prisma: mockPrisma,
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
  // SET NX EX called by rateLimiter (and loginBruteForce.recordLoginFailure) —
  // default to OK (key created); tests that need the NX no-op override per-test.
  mockRedis.set.mockResolvedValue('OK');

  // Prisma: default to user not found — login routes return 401 (wrong creds)
  // rather than trying to reach a real database.
  mockPrisma.user.findUnique.mockResolvedValue(null);
  mockPrisma.user.create.mockResolvedValue({ id: 'mock-id', email: 'x@flowboard.test' });
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

  it('initialises the rate-limit key atomically (SET NX EX) on every request', async () => {
    // The fixed implementation calls SET key 0 NX EX <ttl> before INCR so the
    // TTL is bound atomically. expire() is never called directly.
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');

    await request(app)
      .post('/auth/login')
      .send({ email: 'x@flowboard.test', password: 'SomePass1!' });

    // set() must have been called with NX so the key is only created once
    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^rate:/),
      '0',
      'EX',
      15 * 60,
      'NX'
    );
    // expire() must never be called — the TTL is set atomically via SET NX EX
    expect(mockRedis.expire).not.toHaveBeenCalled();
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

  it('never calls expire — TTL is always set via SET NX EX, not a separate EXPIRE', async () => {
    // Even on subsequent requests (count > 1) the SET NX is a no-op on an
    // existing key, and expire() is never called at all.
    mockRedis.incr.mockResolvedValue(5);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(null); // NX no-op — key already exists

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

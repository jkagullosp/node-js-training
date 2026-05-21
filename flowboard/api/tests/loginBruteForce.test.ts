/**
 * loginBruteForce.test.ts
 *
 * Tests the login brute-force protection middleware in isolation using a mocked
 * Redis client. We mock '../src/lib/redis' so we can control what redis returns
 * without needing a real Redis instance.
 *
 * IMPORTANT: jest.mock() is hoisted above imports — the mock is in place before
 * the app module is evaluated, which means the loginBruteForce middleware picks
 * up the mocked redis client on first import.
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
import { createApp } from '../src/app';
import { checkLoginFailures, recordLoginFailure, resetLoginFailures } from '../src/middleware/loginBruteForce';
import { AppError } from '../src/errors/AppError';

const MAX_FAILURES = 10;
const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.quit.mockResolvedValue('OK');
  mockRedis.ping.mockResolvedValue('PONG');
  mockRedis.xadd.mockResolvedValue('0-1');
  mockRedis.incr.mockResolvedValue(1);       // rateLimiter passes through by default
  mockRedis.get.mockResolvedValue(null);     // no lockout by default
  mockRedis.expire.mockResolvedValue(1);
  mockRedis.del.mockResolvedValue(1);
  mockRedis.set.mockResolvedValue('OK');
});

afterAll(async () => {
  // Redis is mocked, Prisma not used — nothing to tear down
});

// ---------------------------------------------------------------------------
// checkLoginFailures
// ---------------------------------------------------------------------------
describe('checkLoginFailures', () => {
  it('throws a 429 AppError when count is at the threshold', async () => {
    mockRedis.get.mockResolvedValue(String(MAX_FAILURES));
    await expect(checkLoginFailures('1.2.3.4')).rejects.toThrow(AppError);
    // also verify status/code
    await expect(checkLoginFailures('1.2.3.4')).rejects.toMatchObject({ statusCode: 429, code: 'RATE_LIMIT_EXCEEDED' });
  });

  it('calls redis.get with the correct key', async () => {
    await checkLoginFailures('1.2.3.4');
    expect(mockRedis.get).toHaveBeenCalledWith('login:fail:1.2.3.4');
  });

  it('does not throw when count is below threshold', async () => {
    mockRedis.get.mockResolvedValue(String(MAX_FAILURES - 1));
    await expect(checkLoginFailures('1.2.3.4')).resolves.toBeUndefined();
  });

  it('does not throw when key does not exist (null)', async () => {
    mockRedis.get.mockResolvedValue(null);
    await expect(checkLoginFailures('1.2.3.4')).resolves.toBeUndefined();
  });

  it('fails open when Redis throws (does not propagate Redis errors)', async () => {
    mockRedis.get.mockRejectedValue(new Error('Redis unavailable'));
    await expect(checkLoginFailures('1.2.3.4')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// recordLoginFailure
// ---------------------------------------------------------------------------
describe('recordLoginFailure', () => {
  it('calls SET NX EX to atomically initialise the key, then INCR', async () => {
    // The fixed implementation uses SET key 0 NX EX 60 before INCR so the TTL
    // is bound atomically at key creation. expire() is never called directly.
    await recordLoginFailure('1.2.3.4');
    expect(mockRedis.set).toHaveBeenCalledWith('login:fail:1.2.3.4', '0', 'EX', 60, 'NX');
    expect(mockRedis.incr).toHaveBeenCalledWith('login:fail:1.2.3.4');
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it('always calls SET NX EX on every failure — NX is a no-op when key exists', async () => {
    // On a subsequent failure the SET NX returns null (key already present) and
    // INCR increments the existing counter. expire() is never called regardless.
    mockRedis.set.mockResolvedValue(null); // NX no-op
    mockRedis.incr.mockResolvedValue(5);
    await recordLoginFailure('1.2.3.4');
    expect(mockRedis.set).toHaveBeenCalledWith('login:fail:1.2.3.4', '0', 'EX', 60, 'NX');
    expect(mockRedis.incr).toHaveBeenCalledWith('login:fail:1.2.3.4');
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it('does not throw when Redis throws (fails silently)', async () => {
    mockRedis.set.mockRejectedValue(new Error('Redis unavailable'));
    await expect(recordLoginFailure('1.2.3.4')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resetLoginFailures
// ---------------------------------------------------------------------------
describe('resetLoginFailures', () => {
  it('calls redis.del with the correct key', async () => {
    await resetLoginFailures('1.2.3.4');
    expect(mockRedis.del).toHaveBeenCalledWith('login:fail:1.2.3.4');
  });

  it('does not throw when Redis throws (fails silently)', async () => {
    mockRedis.del.mockRejectedValue(new Error('Redis unavailable'));
    await expect(resetLoginFailures('1.2.3.4')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// HTTP-level test (supertest + mocked Redis)
// ---------------------------------------------------------------------------
describe('POST /auth/login — brute-force lockout (mocked Redis)', () => {
  it('returns 429 with RATE_LIMIT_EXCEEDED when failure count is at threshold', async () => {
    // incr stays at 1 so rateLimiter passes; get returns threshold so brute-force check fires
    mockRedis.get.mockResolvedValue(String(MAX_FAILURES));

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'x@flowboard.test', password: 'SomePass1!' });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});

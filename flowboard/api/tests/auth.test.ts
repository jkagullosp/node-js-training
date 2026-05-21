import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { cleanDb } from './helpers';
import { prisma } from '../src/lib/prisma';

const app = createApp();

beforeEach(async () => {
  await cleanDb();
});

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------
describe('POST /auth/register', () => {
  it('returns 201 with accessToken and refreshToken on valid payload', async () => {
    const res = await request(app).post('/auth/register').send({
      email: `reg-valid-${Date.now()}@flowboard.test`,
      password: 'TestPass123!',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
  });

  it('returns 409 on duplicate email', async () => {
    const email = `reg-dup-${Date.now()}@flowboard.test`;

    await request(app).post('/auth/register').send({ email, password: 'TestPass123!' });

    const res = await request(app).post('/auth/register').send({
      email,
      password: 'TestPass123!',
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('returns 422 when password is missing', async () => {
    const res = await request(app).post('/auth/register').send({
      email: `reg-nopw-${Date.now()}@flowboard.test`,
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 on invalid email format', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'not-an-email',
      password: 'TestPass123!',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
describe('POST /auth/login', () => {
  const email = `login-${Date.now()}@flowboard.test`;
  const password = 'LoginPass123!';

  beforeEach(async () => {
    // Re-create the user after each cleanDb()
    await request(app).post('/auth/register').send({ email, password });
  });

  it('returns 200 with token pair on valid credentials', async () => {
    const res = await request(app).post('/auth/login').send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: 'WrongPass999!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 on nonexistent email', async () => {
    const res = await request(app).post('/auth/login').send({
      email: `nobody-${Date.now()}@flowboard.test`,
      password: 'SomePass123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /auth/refresh
// ---------------------------------------------------------------------------
describe('POST /auth/refresh', () => {
  it('returns 200 with a new token pair on valid refresh token', async () => {
    const regRes = await request(app).post('/auth/register').send({
      email: `refresh-ok-${Date.now()}@flowboard.test`,
      password: 'RefreshPass123!',
    });
    const { refreshToken } = regRes.body.data;

    const res = await request(app).post('/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
  });

  it('returns 401 on replay attack — second use of the same refresh token', async () => {
    const regRes = await request(app).post('/auth/register').send({
      email: `replay-${Date.now()}@flowboard.test`,
      password: 'ReplayPass123!',
    });
    const { refreshToken } = regRes.body.data;

    // First use — should succeed and rotate the token
    const first = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);

    // Second use of the original token — must be rejected
    const second = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(second.status).toBe(401);
    expect(second.body.success).toBe(false);
  });

  it('returns 401 on an invalid/malformed token', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'this.is.not.a.valid.jwt' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when refresh token is valid JWT but payload has no sub/jti', async () => {
    const badToken = jwt.sign({ foo: 'bar' }, process.env['JWT_REFRESH_SECRET']!, { expiresIn: '1m' });
    const res = await request(app).post('/auth/refresh').send({ refreshToken: badToken });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when user has been deleted after token issuance', async () => {
    const email = `deleted-${Date.now()}@flowboard.test`;
    const reg = await request(app).post('/auth/register').send({ email, password: 'TestPass1!' });
    const { refreshToken } = reg.body.data;

    await prisma.user.deleteMany({ where: { email } });

    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------
describe('POST /auth/logout', () => {
  it('returns 204 on valid refresh token', async () => {
    const regRes = await request(app).post('/auth/register').send({
      email: `logout-ok-${Date.now()}@flowboard.test`,
      password: 'LogoutPass123!',
    });
    const { refreshToken } = regRes.body.data;

    const res = await request(app).post('/auth/logout').send({ refreshToken });

    expect(res.status).toBe(204);
  });

  it('returns 204 when refresh token is valid JWT but has wrong payload shape', async () => {
    const badToken = jwt.sign({ foo: 'bar' }, process.env['JWT_REFRESH_SECRET']!, { expiresIn: '1m' });
    const res = await request(app).post('/auth/logout').send({ refreshToken: badToken });
    expect(res.status).toBe(204);
  });

  it('returns 204 even when called twice (idempotent logout)', async () => {
    // The route is intentionally idempotent — an already-invalidated token
    // still results in 204, not 401. The token is simply deleted from Redis
    // on first call; the second call silently does nothing.
    const regRes = await request(app).post('/auth/register').send({
      email: `logout-idem-${Date.now()}@flowboard.test`,
      password: 'LogoutPass123!',
    });
    const { refreshToken } = regRes.body.data;

    await request(app).post('/auth/logout').send({ refreshToken });
    const res = await request(app).post('/auth/logout').send({ refreshToken });

    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// Protected endpoint — no token
// ---------------------------------------------------------------------------
describe('Auth middleware — missing token', () => {
  it('returns 401 when Authorization header is absent on a protected route', async () => {
    const res = await request(app).get('/boards');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when Authorization header is malformed (no Bearer prefix)', async () => {
    const res = await request(app)
      .get('/boards')
      .set('Authorization', 'Token not-a-bearer-token');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when Bearer token is a garbage string', async () => {
    const res = await request(app)
      .get('/boards')
      .set('Authorization', 'Bearer totally.not.valid');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when Bearer token is valid JWT but payload has no sub/email fields', async () => {
    const token = jwt.sign({ foo: 'bar' }, process.env['JWT_SECRET']!, { expiresIn: '1m' });
    const res = await request(app).get('/boards').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// POST /auth/login — brute-force protection (real Redis + Prisma)
// ---------------------------------------------------------------------------
describe('POST /auth/login — brute-force protection', () => {
  // 10 bcrypt compares @ cost 12 ≈ 1–3s; give the test room to breathe
  jest.setTimeout(15000);

  it('returns 429 after MAX_FAILURES failed attempts from the same IP', async () => {
    const email = `brute-${Date.now()}@flowboard.test`;

    // Fire 10 failed attempts — user does not exist, dummy-hash bcrypt runs each time
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/auth/login')
        .send({ email, password: 'WrongPass1!' });
    }

    // The 11th attempt must be blocked
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: 'WrongPass1!' });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('resets the failure counter after a successful login', async () => {
    const email = `brute-reset-${Date.now()}@flowboard.test`;
    const password = 'RealPass123!';

    await request(app).post('/auth/register').send({ email, password });

    // Accumulate 5 failures
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/auth/login')
        .send({ email, password: 'WrongPass1!' });
    }

    // Successful login — resets the counter
    const success = await request(app).post('/auth/login').send({ email, password });
    expect(success.status).toBe(200);

    // One more failure after reset — counter is now 1, not 6; must be 401 not 429
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: 'WrongPass1!' });

    expect(res.status).toBe(401);
  });
});

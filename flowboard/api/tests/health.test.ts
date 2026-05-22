import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
describe('GET /health', () => {
  it('returns 200 with status ok and a numeric uptime', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// GET /ready
// ---------------------------------------------------------------------------
describe('GET /ready', () => {
  it('returns 200 with db and redis ok when all dependencies are reachable', async () => {
    const res = await request(app).get('/ready');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.db).toBe('ok');
    expect(res.body.redis).toBe('ok');
  });

  it('returns 404 with NOT_FOUND for an unknown route', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  // NOTE — Manual verification required for the 503 path:
  //
  // The /ready 503 branch fires only when PostgreSQL or Redis is unreachable.
  // Stopping a container mid-test is not feasible in this automated suite without
  // additional tooling. To verify:
  //
  //   1. docker compose -f docker-compose.test.yml stop db
  //   2. curl http://localhost:<api-port>/ready
  //      → expect: HTTP 503, { "success": false, "code": "NOT_READY" }
  //   3. docker compose -f docker-compose.test.yml start db
});

// ---------------------------------------------------------------------------
// CORS — production mode origin validation
// ---------------------------------------------------------------------------
describe('CORS — production mode origin validation', () => {
  it('allows a request from a whitelisted origin in production mode', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['ALLOWED_ORIGINS'] = 'http://allowed.test';
    const corsApp = createApp();

    const res = await request(corsApp).get('/health').set('Origin', 'http://allowed.test');
    process.env['NODE_ENV'] = 'test';

    expect(res.status).toBe(200);
  });

  it('blocks a request from a non-whitelisted origin in production mode', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['ALLOWED_ORIGINS'] = 'http://allowed.test';
    const corsApp = createApp();

    const res = await request(corsApp).get('/health').set('Origin', 'http://evil.com');
    process.env['NODE_ENV'] = 'test';

    expect(res.status).toBe(403);
  });
});

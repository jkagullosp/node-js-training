import request from 'supertest';
import { createApp } from '../src/app';
import { cleanDb } from './helpers';

const app = createApp();

let token: string;

beforeAll(async () => {
  await cleanDb();

  const res = await request(app).post('/auth/register').send({
    email: 'auditlogs@flowboard.test',
    password: 'AuditPass123!',
  });
  token = res.body.data.accessToken;
});

afterAll(async () => {
  await cleanDb();
});

// ---------------------------------------------------------------------------
// GET /audit-logs
// ---------------------------------------------------------------------------
describe('GET /audit-logs', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app).get('/audit-logs');
    expect(res.status).toBe(401);
  });

  it('returns 200 with an array (empty when no logs exist)', async () => {
    const res = await request(app)
      .get('/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 200 and respects the limit query parameter', async () => {
    const res = await request(app)
      .get('/audit-logs?limit=5&offset=0')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 422 when limit is out of range', async () => {
    const res = await request(app)
      .get('/audit-logs?limit=0')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

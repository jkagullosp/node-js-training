import request from 'supertest';
import { createApp } from '../src/app';
import { cleanDb } from './helpers';
import { prisma } from '../src/lib/prisma';

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

// ---------------------------------------------------------------------------
// GET /audit-logs — cross-user isolation
// ---------------------------------------------------------------------------
describe('GET /audit-logs — cross-user isolation', () => {
  let tokenA: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const emailA = `auditA-${Date.now()}@flowboard.test`;
    const emailB = `auditB-${Date.now() + 1}@flowboard.test`;

    const resA = await request(app).post('/auth/register').send({
      email: emailA,
      password: 'AuditPassA1!',
    });
    tokenA = resA.body.data.accessToken;

    await request(app).post('/auth/register').send({
      email: emailB,
      password: 'AuditPassB1!',
    });

    const userA = await prisma.user.findUniqueOrThrow({ where: { email: emailA } });
    const userB = await prisma.user.findUniqueOrThrow({ where: { email: emailB } });
    userAId = userA.id;
    userBId = userB.id;

    await prisma.auditLog.createMany({
      data: [
        {
          userId: userAId,
          action: 'CREATE_TASK',
          entity: 'Task',
          entityId: '00000000-0000-0000-0000-000000000001',
        },
        {
          userId: userBId,
          action: 'CREATE_TASK',
          entity: 'Task',
          entityId: '00000000-0000-0000-0000-000000000002',
        },
      ],
    });
  });

  it("returns only the authenticated user's entries — none from other users", async () => {
    const res = await request(app)
      .get('/audit-logs')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    for (const entry of res.body.data as Array<{ userId: string }>) {
      expect(entry.userId).toBe(userAId);
    }

    const userBEntries = (res.body.data as Array<{ userId: string }>).filter(
      (e) => e.userId === userBId,
    );
    expect(userBEntries).toHaveLength(0);
  });
});

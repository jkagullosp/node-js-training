import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { cleanDb } from './helpers';

const app = createApp();

// Tokens for two distinct users — populated in beforeAll
let tokenA: string;
let tokenB: string;

beforeAll(async () => {
  await cleanDb();

  const resA = await request(app).post('/auth/register').send({
    email: 'boardsA@flowboard.test',
    password: 'BoardsPassA1!',
  });
  tokenA = resA.body.data.accessToken;

  const resB = await request(app).post('/auth/register').send({
    email: 'boardsB@flowboard.test',
    password: 'BoardsPassB1!',
  });
  tokenB = resB.body.data.accessToken;
});

// Remove boards (and their tasks) between tests so tests are independent.
// We keep the users alive so tokens remain valid.
afterEach(async () => {
  await prisma.task.deleteMany();
  await prisma.board.deleteMany();
});

afterAll(async () => {
  await cleanDb();
});

// ---------------------------------------------------------------------------
// GET /boards
// ---------------------------------------------------------------------------
describe('GET /boards', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app).get('/boards');
    expect(res.status).toBe(401);
  });

  it('returns 200 with an empty array when the user has no boards', async () => {
    const res = await request(app)
      .get('/boards')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns only the requesting user\'s boards — not other users\'', async () => {
    // Create a board as userA
    await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'UserA Board' });

    // Create a board as userB
    await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'UserB Board' });

    // UserA should only see their own board
    const resA = await request(app)
      .get('/boards')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(resA.status).toBe(200);
    expect(resA.body.data).toHaveLength(1);
    expect(resA.body.data[0].name).toBe('UserA Board');
  });
});

// ---------------------------------------------------------------------------
// POST /boards
// ---------------------------------------------------------------------------
describe('POST /boards', () => {
  it('returns 201 with the created board on valid payload', async () => {
    const res = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'My New Board' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('My New Board');
    expect(typeof res.body.data.id).toBe('string');
  });

  it('returns 422 when name is missing', async () => {
    const res = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when an extra unknown field is sent (strict schema)', async () => {
    const res = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Valid Board', extraField: 'should-be-rejected' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// GET /boards/:id
// ---------------------------------------------------------------------------
describe('GET /boards/:id', () => {
  it('returns 422 when the id param is not a valid UUID', async () => {
    const res = await request(app)
      .get('/boards/not-a-uuid')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with board and tasks when the owner requests it', async () => {
    const createRes = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Board With Tasks' });
    const boardId = createRes.body.data.id;

    const res = await request(app)
      .get(`/boards/${boardId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(boardId);
    expect(Array.isArray(res.body.data.tasks)).toBe(true);
  });

  it('returns 404 for a nonexistent board id', async () => {
    const res = await request(app)
      .get('/boards/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when a different user requests the board', async () => {
    const createRes = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'UserA Private Board' });
    const boardId = createRes.body.data.id;

    // UserB tries to access UserA's board
    const res = await request(app)
      .get(`/boards/${boardId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// DELETE /boards/:id
// ---------------------------------------------------------------------------
describe('DELETE /boards/:id', () => {
  it('returns 204 when the owner deletes their board', async () => {
    const createRes = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Board To Delete' });
    const boardId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/boards/${boardId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(204);
  });

  it('returns 404 for a nonexistent board id', async () => {
    const res = await request(app)
      .delete('/boards/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when a non-owner attempts to delete the board', async () => {
    const createRes = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'UserA Board To Guard' });
    const boardId = createRes.body.data.id;

    // UserB tries to delete UserA's board
    const res = await request(app)
      .delete(`/boards/${boardId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});

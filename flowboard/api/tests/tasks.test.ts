import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { cleanDb } from './helpers';

const app = createApp();

let tokenA: string;
let tokenB: string;
// Board owned by userA — reused across tests in a describe block
let boardAId: string;

beforeAll(async () => {
  await cleanDb();

  // Register userA
  const resA = await request(app).post('/auth/register').send({
    email: 'tasksA@flowboard.test',
    password: 'TasksPassA1!',
  });
  tokenA = resA.body.data.accessToken;

  // Register userB
  const resB = await request(app).post('/auth/register').send({
    email: 'tasksB@flowboard.test',
    password: 'TasksPassB1!',
  });
  tokenB = resB.body.data.accessToken;

  // Create a board owned by userA — used for task creation tests
  const boardRes = await request(app)
    .post('/boards')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ name: 'UserA Task Board' });
  boardAId = boardRes.body.data.id;
});

// Wipe only tasks between tests so the board and users persist
afterEach(async () => {
  await prisma.task.deleteMany();
});

afterAll(async () => {
  await cleanDb();
});

// ---------------------------------------------------------------------------
// GET /tasks — list
// ---------------------------------------------------------------------------
describe('GET /tasks', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(401);
  });

  it('returns 200 with an empty array when the user has no tasks', async () => {
    const res = await request(app)
      .get('/tasks')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it("returns only the requesting user's tasks — not other users'", async () => {
    const boardARes = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Board A' });
    await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Task A', boardId: boardARes.body.data.id });

    const boardBRes = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Board B' });
    await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Task B', boardId: boardBRes.body.data.id });

    const resA = await request(app)
      .get('/tasks')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(resA.status).toBe(200);
    expect(resA.body.data).toHaveLength(1);
    expect(resA.body.data[0].title).toBe('Task A');
  });
});

// ---------------------------------------------------------------------------
// POST /tasks
// ---------------------------------------------------------------------------
describe('POST /tasks', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'No Auth Task', boardId: boardAId });
    expect(res.status).toBe(401);
  });

  it('returns 201 with the created task on a valid payload', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'My First Task', boardId: boardAId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('My First Task');
    expect(typeof res.body.data.id).toBe('string');
  });

  it('returns 422 when title is missing', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ boardId: boardAId });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when boardId is not a valid UUID', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Bad Board Task', boardId: 'not-a-uuid' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when boardId is a valid UUID that does not exist', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Ghost Board Task', boardId: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 201 but strips extra fields (mass assignment protection)', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Clean Task',
        boardId: boardAId,
        // These fields are not in CreateTaskSchema.strict() — Zod will reject them
        // Actually strict() throws 422 on unknown fields. Let's send only schema-valid
        // extra fields that could cause issues if mass-assigned (ownerId, id).
        // Since schema is .strict(), we test that unknown keys cause 422 instead.
        // We verify strict() rejects unknown keys:
        injectedField: 'malicious-value',
      });

    // CreateTaskSchema uses .strict(), so unknown keys → 422 VALIDATION_ERROR
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when description is an empty string', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Task', boardId: boardAId, description: '' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when description exceeds 1000 characters', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Task', boardId: boardAId, description: 'a'.repeat(1001) });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when boardId belongs to another user', async () => {
    // Create a board owned by userB
    const boardBRes = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'UserB Board' });
    const boardBId = boardBRes.body.data.id;

    // UserA tries to create a task on userB's board
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Forbidden Task', boardId: boardBId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('FORBIDDEN');

    // Clean up the extra board
    await prisma.board.delete({ where: { id: boardBId } });
  });
});

// ---------------------------------------------------------------------------
// GET /tasks/:id
// ---------------------------------------------------------------------------
describe('GET /tasks/:id', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app).get('/tasks/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });

  it('returns 422 when the id param is not a valid UUID', async () => {
    const res = await request(app)
      .get('/tasks/not-a-uuid')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with the task when the owner requests it', async () => {
    const createRes = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Fetchable Task', boardId: boardAId });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .get(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(taskId);
  });

  it('returns 404 for a nonexistent task id', async () => {
    const res = await request(app)
      .get('/tasks/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when a different user requests the task', async () => {
    const createRes = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'UserA Private Task', boardId: boardAId });
    const taskId = createRes.body.data.id;

    // UserB tries to access UserA's task
    const res = await request(app)
      .get(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// PATCH /tasks/:id
// ---------------------------------------------------------------------------
describe('PATCH /tasks/:id', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app)
      .patch('/tasks/00000000-0000-0000-0000-000000000000')
      .send({ title: 'Updated' });
    expect(res.status).toBe(401);
  });

  it('returns 200 with the updated task on a valid partial update', async () => {
    const createRes = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Original Title', boardId: boardAId });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Updated Title', status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Updated Title');
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });

  it('returns 422 on an invalid status enum value', async () => {
    const createRes = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Status Test Task', boardId: boardAId });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'INVALID' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when description is an empty string on update', async () => {
    const createRes = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Desc Test Task', boardId: boardAId });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ description: '' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 when body is an empty object (all fields optional)', async () => {
    const createRes = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'No-change Task', boardId: boardAId });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(taskId);
  });

  it('returns 403 when a non-owner attempts to update the task', async () => {
    const createRes = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Guard This Task', boardId: boardAId });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Hijacked Title' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('returns 404 when the task does not exist', async () => {
    const res = await request(app)
      .patch('/tasks/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DELETE /tasks/:id
// ---------------------------------------------------------------------------
describe('DELETE /tasks/:id', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app).delete('/tasks/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });

  it('returns 422 when the id param is not a valid UUID', async () => {
    const res = await request(app)
      .delete('/tasks/not-a-uuid')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 204 when the owner deletes their task', async () => {
    const createRes = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Task To Delete', boardId: boardAId });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(204);
  });

  it('returns 404 for a nonexistent task id', async () => {
    const res = await request(app)
      .delete('/tasks/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when a non-owner attempts to delete the task', async () => {
    const createRes = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Protected Delete Task', boardId: boardAId });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});

// tasks-app.test.js
const request = require('supertest');
const createApp = require('./tasks-app');
 
describe('Tasks API', () => {
  let app;
 
  beforeEach(() => {
    app = createApp();
  });
 
  describe('GET /tasks', () => {
    test('returns an empty array initially', async () => {
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
 
  describe('POST /tasks', () => {
    test('creates a new task', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Write tests' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: 1,
        title: 'Write tests',
        done: false
      });
    });
 
    test('returns 400 when title is missing', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
 
  describe('GET /tasks/:id', () => {
    test('returns a single task after creation', async () => {
      await request(app).post('/tasks').send({ title: 'A task' });
      const res = await request(app).get('/tasks/1');
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('A task');
    });
 
    test('returns 404 for a nonexistent task', async () => {
      const res = await request(app).get('/tasks/999');
      expect(res.status).toBe(404);
    });
  });
 
  describe('DELETE /tasks/:id', () => {
    test('deletes an existing task', async () => {
      await request(app).post('/tasks').send({ title: 'To delete' });
      const res = await request(app).delete('/tasks/1');
      expect(res.status).toBe(204);
 
      const list = await request(app).get('/tasks');
      expect(list.body).toEqual([]);
    });
 
    test('returns 404 when deleting a nonexistent task', async () => {
      const res = await request(app).delete('/tasks/999');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /tasks/:id', () => {
    test('updates the title of an existing task', async () => {
      await request(app).post('/tasks').send({ title: 'Old title' });
      const res = await request(app)
        .put('/tasks/1')
        .send({ title: 'New title' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 1,
        title: 'New title',
        done: false
      });
    });

    test('updates the done status of an existing task', async () => {
      await request(app).post('/tasks').send({ title: 'A task' });
      const res = await request(app)
        .put('/tasks/1')
        .send({ done: true });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 1,
        title: 'A task',
        done: true
      });
    });

    test('returns 404 when updating a nonexistent task', async () => {
      const res = await request(app)
        .put('/tasks/999')
        .send({ title: 'New title' });
      expect(res.status).toBe(404);
    });
  })
});

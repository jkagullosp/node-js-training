// comment-api.test.js
const request = require('supertest');
const createCommentApp = require('./comment-api');

describe('Comments API', () => {
  let app;

  beforeEach(() => {
    app = createCommentApp();
  });

  describe('POST /comments', () => {
    test('creates a comment with text and author', async () => {
      const res = await request(app)
        .post('/comments')
        .send({ text: 'Great post!', author: 'John' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: 1,
        text: 'Great post!',
        author: 'John'
      });
    });

    test('returns 400 when text is missing', async () => {
      const res = await request(app)
        .post('/comments')
        .send({ author: 'John' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('returns 400 when author is missing', async () => {
      const res = await request(app)
        .post('/comments')
        .send({ text: 'Great post!' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /comments', () => {
    test('returns all comments', async () => {
      await request(app)
        .post('/comments')
        .send({ text: 'First comment', author: 'Alice' });
      await request(app)
        .post('/comments')
        .send({ text: 'Second comment', author: 'Bob' });

      const res = await request(app).get('/comments');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toMatchObject({
        id: 1,
        text: 'First comment',
        author: 'Alice'
      });
      expect(res.body[1]).toMatchObject({
        id: 2,
        text: 'Second comment',
        author: 'Bob'
      });
    });
  });

  describe('GET /comments/:id', () => {
    test('returns one comment', async () => {
      await request(app)
        .post('/comments')
        .send({ text: 'Test comment', author: 'Charlie' });

      const res = await request(app).get('/comments/1');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 1,
        text: 'Test comment',
        author: 'Charlie'
      });
    });

    test('returns 404 for missing ids', async () => {
      const res = await request(app).get('/comments/999');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });
});

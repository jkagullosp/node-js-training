const request = require('supertest');
const createApp = require('../src/app');

jest.mock('../src/db', () => ({
  note: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

const prisma = require('../src/db');
const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();
});

// GET /health
describe('GET /health', () => {
  test('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

// GET /notes
describe('GET /notes', () => {
  test('returns 200 with list of notes', async () => {
    const notes = [
      { id: 1, title: 'Note 1', content: 'Content 1', tag: null, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
    ];
    prisma.note.findMany.mockResolvedValue(notes);

    const res = await request(app).get('/notes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(notes);
  });

  test('returns 500 when database fails', async () => {
    prisma.note.findMany.mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/notes');
    expect(res.status).toBe(500);
    expect(res.body.error.status).toBe(500);
  });
});

// GET /notes/:id
describe('GET /notes/:id', () => {
  test('returns 200 with the note', async () => {
    const note = { id: 1, title: 'Note 1', content: 'Content 1', tag: null, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' };
    prisma.note.findUnique.mockResolvedValue(note);

    const res = await request(app).get('/notes/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(note);
  });

  test('returns 404 when note does not exist', async () => {
    prisma.note.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/notes/999');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Note not found');
  });
});

// POST /notes
describe('POST /notes', () => {
  test('returns 201 with created note', async () => {
    const note = { id: 1, title: 'Shopping list', content: 'Milk, bread, eggs', tag: 'personal', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' };
    prisma.note.create.mockResolvedValue(note);

    const res = await request(app).post('/notes').send({
      title: 'Shopping list',
      content: 'Milk, bread, eggs',
      tag: 'personal',
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(note);
  });

  test('returns 400 when title is missing', async () => {
    const res = await request(app).post('/notes').send({ content: 'Some content' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('title is required');
  });

  test('returns 400 when content is missing', async () => {
    const res = await request(app).post('/notes').send({ title: 'Some title' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('content is required');
  });

  test('returns 400 when title exceeds 100 characters', async () => {
    const res = await request(app).post('/notes').send({
      title: 'a'.repeat(101),
      content: 'Some content',
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when content exceeds 5000 characters', async () => {
    const res = await request(app).post('/notes').send({
      title: 'Some title',
      content: 'a'.repeat(5001),
    });
    expect(res.status).toBe(400);
  });
});

// PUT /notes/:id
describe('PUT /notes/:id', () => {
  test('returns 200 with updated note', async () => {
    const updated = { id: 1, title: 'Updated title', content: 'Updated content', tag: null, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z' };
    prisma.note.update.mockResolvedValue(updated);

    const res = await request(app).put('/notes/1').send({ title: 'Updated title', content: 'Updated content' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
  });

  test('returns 404 when note does not exist', async () => {
    const error = new Error('Not found');
    error.code = 'P2025';
    prisma.note.update.mockRejectedValue(error);

    const res = await request(app).put('/notes/999').send({ title: 'Updated title' });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Note not found');
  });

  test('returns 400 when title is an empty string', async () => {
    const res = await request(app).put('/notes/1').send({ title: '' });
    expect(res.status).toBe(400);
  });
});

// DELETE /notes/:id
describe('DELETE /notes/:id', () => {
  test('returns 204 on successful delete', async () => {
    prisma.note.delete.mockResolvedValue({});

    const res = await request(app).delete('/notes/1');
    expect(res.status).toBe(204);
  });

  test('returns 404 when note does not exist', async () => {
    const error = new Error('Not found');
    error.code = 'P2025';
    prisma.note.delete.mockRejectedValue(error);

    const res = await request(app).delete('/notes/999');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Note not found');
  });
});

# Module 10 Capstone — Notes API

A REST API for managing personal notes. Built with Node.js, Express, and Prisma (SQLite).

## Setup

```bash
npm install
cp .env.example .env
npm run db:migrate
```

## Running

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3000` by default.

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Endpoints

| Method | Route | Description | Status |
|--------|-------|-------------|--------|
| GET | `/health` | Health check | 200 |
| GET | `/notes` | List all notes, newest first | 200 |
| GET | `/notes/:id` | Get a single note | 200 / 404 |
| POST | `/notes` | Create a new note | 201 / 400 |
| PUT | `/notes/:id` | Update a note | 200 / 400 / 404 |
| DELETE | `/notes/:id` | Delete a note | 204 / 404 |

## Request & Response

### POST /notes

**Request body:**
```json
{
  "title": "Shopping list",
  "content": "Milk, bread, eggs",
  "tag": "personal"
}
```

**Response `201`:**
```json
{
  "id": 1,
  "title": "Shopping list",
  "content": "Milk, bread, eggs",
  "tag": "personal",
  "createdAt": "2025-10-28T03:15:00.000Z",
  "updatedAt": "2025-10-28T03:15:00.000Z"
}
```

### Error format

All errors follow this shape:
```json
{
  "error": {
    "status": 400,
    "message": "title is required"
  }
}
```

## Field Rules

| Field | Rules |
|-------|-------|
| `title` | Required. String. 1–100 characters. |
| `content` | Required. String. 1–5000 characters. |
| `tag` | Optional. String. Max 30 characters. |
| `id` | Auto-generated. |
| `createdAt` | Auto-set on creation. |
| `updatedAt` | Auto-updated on modification. |

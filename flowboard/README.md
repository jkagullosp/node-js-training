# FlowBoard

A containerized, production-grade task management REST API in the style of Trello/Jira. Built with Node.js 22, Express, TypeScript strict mode, Prisma + PostgreSQL, Redis, and Docker Compose.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Docker Commands](#docker-commands)
- [API Endpoints](#api-endpoints)
  - [Health](#health)
  - [Auth](#auth)
  - [Boards](#boards)
  - [Tasks](#tasks)
  - [Audit Logs](#audit-logs)
- [Authentication Flow](#authentication-flow)
- [Redis Usage](#redis-usage)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Logging](#logging)
- [Project Structure](#project-structure)

---

## Project Overview

FlowBoard is a multi-user task management backend. Users register and log in to receive JWT access and refresh tokens. Each user can create boards, and within those boards create tasks with status and priority tracking. All task mutations are published to a Redis Stream — a separate worker service consumes those events and writes AuditLog records to PostgreSQL.

The entire system runs in Docker containers. Traffic enters through Nginx, which reverse-proxies to the API on port 3000. No service is exposed directly to the host except through Nginx on port 80 (or the test compose ports for integration testing).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 (Alpine) |
| Framework | Express 4.x |
| Language | TypeScript 5, strict mode |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Cache / Sessions | Redis 7 |
| Background Worker | Separate containerized service |
| Validation | Zod 3 |
| Logging | Pino 8 (with pino-http) |
| Auth | JWT (jsonwebtoken 9) + bcrypt (cost 12) |
| Security headers | Helmet 7 |
| Reverse proxy | Nginx (Alpine) |
| Testing | Jest 29 + Supertest 6 |
| Container | Docker + Docker Compose |

---

## Prerequisites

- **Docker Desktop** (or Docker Engine + Docker Compose plugin) — all services run in containers; nothing runs on the host directly
- **Node.js 22+** — only needed if you want to run local commands outside Docker (e.g., `npm run db:studio`)
- **Git**

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd flowboard
```

### 2. Configure environment variables

The API and worker each have their own `.env.example`. Copy and edit both before starting:

```bash
cp api/.env.example api/.env
cp worker/.env.example worker/.env
```

At minimum, change the placeholder JWT secrets in `api/.env`:

```
JWT_SECRET="<at-least-32-random-chars>"
JWT_REFRESH_SECRET="<different-at-least-32-random-chars>"
```

See [Environment Variables](#environment-variables) for the full reference.

### 3. Build and start all services

```bash
docker compose up --build -d
```

This starts: PostgreSQL, Redis, the API (with `prisma migrate deploy` on startup), the worker, and Nginx.

### 4. Verify everything is running

```bash
curl http://localhost/health
# {"status":"ok","uptime":<seconds>}

curl http://localhost/ready
# {"status":"ready","db":"ok","redis":"ok"}
```

### 5. (Optional) Seed the database

The seed script creates a dev user (`dev@flowboard.local` / `Password1!`) with two boards and four sample tasks:

```bash
docker compose exec api npx prisma db seed
```

---

## Environment Variables

### API (`api/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string, e.g. `postgresql://flowboard:flowboard@db:5432/flowboard` |
| `REDIS_URL` | Yes | — | Redis connection string, e.g. `redis://redis:6379` |
| `JWT_SECRET` | Yes | — | Secret for signing access tokens. Must be at least 32 characters. |
| `JWT_REFRESH_SECRET` | Yes | — | Secret for signing refresh tokens. Must be different from `JWT_SECRET`, at least 32 characters. |
| `NODE_ENV` | No | `development` | One of `development`, `test`, `production`. In production, error details are hidden and CORS origin enforcement is active. |
| `PORT` | No | `3000` | Port the Express server listens on inside the container. |
| `ALLOWED_ORIGINS` | No | — | Comma-separated list of allowed CORS origins (e.g. `http://app.example.com`). Enforced only when `NODE_ENV=production`. |
| `LOG_LEVEL` | No | `info` | Pino log level: `fatal`, `error`, `warn`, `info`, `debug`, or `trace`. |

### Worker (`worker/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Same PostgreSQL connection string as the API. |
| `REDIS_URL` | Yes | Same Redis connection string as the API. |
| `NODE_ENV` | No | Affects log level default. |

---

## Docker Commands

All commands are run from the repository root unless noted.

### Build and start

```bash
# Build images and start all services in the background
docker compose up --build -d

# Start without rebuilding
docker compose up -d
```

### Stop and clean up

```bash
# Stop all containers (preserves volumes)
docker compose down

# Stop and remove volumes (destroys all data)
docker compose down -v
```

### View logs

```bash
# Follow logs for all services
docker compose logs -f

# Follow logs for a specific service
docker compose logs -f api
docker compose logs -f worker
```

### Run Prisma commands inside the API container

```bash
# Apply pending migrations
docker compose exec api npx prisma migrate deploy

# Open Prisma Studio (requires port forwarding or local Prisma install)
docker compose exec api npx prisma studio

# Run the dev seed
docker compose exec api npx prisma db seed
```

### Rebuild a single service

```bash
docker compose up --build -d api
```

---

## API Endpoints

All responses share a consistent envelope:

**Success**
```json
{ "success": true, "data": <payload> }
```

**Error**
```json
{ "success": false, "message": "<human-readable>", "code": "<ERROR_CODE>" }
```

**Validation error (422)**
```json
{
  "success": false,
  "message": "Validation error",
  "code": "VALIDATION_ERROR",
  "errors": [ { "path": [...], "message": "..." } ]
}
```

Route parameters that accept an `id` are validated as UUID v4. Non-UUID values return `422 VALIDATION_ERROR` before any database query is executed.

---

### Health

These routes are public — no authentication required.

#### `GET /health`

Lightweight liveness check. Does not touch the database or Redis.

| | |
|---|---|
| Auth | Public |
| Response | `200 OK` |

```bash
curl http://localhost/health
```

```json
{ "status": "ok", "uptime": 42.31 }
```

---

#### `GET /ready`

Readiness check. Verifies that PostgreSQL and Redis are reachable.

| | |
|---|---|
| Auth | Public |
| Response | `200 OK` — both dependencies healthy |
| Response | `503 Service Unavailable` — one or more dependencies unreachable |

```bash
curl http://localhost/ready
```

```json
{ "status": "ready", "db": "ok", "redis": "ok" }
```

---

### Auth

All auth endpoints (`/auth/*`) are rate-limited: **100 requests per IP per 15-minute window**. On breach, returns `429 RATE_LIMIT_EXCEEDED`.

#### `POST /auth/register`

Create a new user account. Returns a JWT access token and a refresh token.

| | |
|---|---|
| Auth | Public |
| Rate limited | Yes |
| Response | `201 Created` |
| Errors | `409 CONFLICT` — email already registered |
| | `422 VALIDATION_ERROR` — invalid input |

**Request body**

| Field | Type | Constraints |
|---|---|---|
| `email` | string | Valid email format |
| `password` | string | Minimum 8 characters |

```bash
curl -X POST http://localhost/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "SecurePass1!"}'
```

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>"
  }
}
```

---

#### `POST /auth/login`

Authenticate with email and password. Returns a new token pair.

| | |
|---|---|
| Auth | Public |
| Rate limited | Yes |
| Response | `200 OK` |
| Errors | `401 UNAUTHORIZED` — invalid credentials |
| | `422 VALIDATION_ERROR` — invalid input |

**Request body**

| Field | Type | Constraints |
|---|---|---|
| `email` | string | Valid email format |
| `password` | string | Minimum 8 characters |

```bash
curl -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "SecurePass1!"}'
```

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>"
  }
}
```

---

#### `POST /auth/refresh`

Exchange a valid refresh token for a new token pair. The submitted refresh token is immediately invalidated (rotation). Reusing an already-rotated token is treated as a breach and returns `401`.

| | |
|---|---|
| Auth | Public |
| Rate limited | Yes |
| Response | `200 OK` |
| Errors | `401 UNAUTHORIZED` — invalid, expired, or already-rotated token |
| | `422 VALIDATION_ERROR` — missing `refreshToken` field |

**Request body**

| Field | Type |
|---|---|
| `refreshToken` | string |

```bash
curl -X POST http://localhost/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<your-refresh-token>"}'
```

```json
{
  "success": true,
  "data": {
    "accessToken": "<new-jwt>",
    "refreshToken": "<new-jwt>"
  }
}
```

---

#### `POST /auth/logout`

Invalidate a refresh token. Idempotent — calling it on an already-invalidated or expired token still returns `204`.

| | |
|---|---|
| Auth | Public |
| Rate limited | No |
| Response | `204 No Content` |
| Errors | `422 VALIDATION_ERROR` — missing `refreshToken` field |

**Request body**

| Field | Type |
|---|---|
| `refreshToken` | string |

```bash
curl -X POST http://localhost/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<your-refresh-token>"}'
```

---

### Boards

All board endpoints require a valid JWT access token in the `Authorization` header. Users can only see and modify their own boards.

**Authorization header format**
```
Authorization: Bearer <accessToken>
```

#### `GET /boards`

List all boards owned by the authenticated user. Returns newest first.

| | |
|---|---|
| Auth | JWT required |
| Response | `200 OK` |
| Errors | `401 UNAUTHORIZED` |

```bash
curl http://localhost/boards \
  -H "Authorization: Bearer <accessToken>"
```

```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4-...",
      "name": "Backend Sprint",
      "ownerId": "user-uuid",
      "createdAt": "2026-05-18T04:34:55.000Z"
    }
  ]
}
```

---

#### `POST /boards`

Create a new board owned by the authenticated user.

| | |
|---|---|
| Auth | JWT required |
| Response | `201 Created` |
| Errors | `401 UNAUTHORIZED`, `422 VALIDATION_ERROR` |

**Request body**

| Field | Type | Constraints |
|---|---|---|
| `name` | string | 1–255 characters |

```bash
curl -X POST http://localhost/boards \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Q3 Roadmap"}'
```

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-...",
    "name": "Q3 Roadmap",
    "ownerId": "user-uuid",
    "createdAt": "2026-05-18T10:00:00.000Z"
  }
}
```

---

#### `GET /boards/:id`

Get a single board by ID, including all its tasks.

| | |
|---|---|
| Auth | JWT required |
| Response | `200 OK` |
| Errors | `401 UNAUTHORIZED`, `403 FORBIDDEN` (board belongs to another user), `404 BOARD_NOT_FOUND`, `422 VALIDATION_ERROR` (non-UUID id) |

```bash
curl http://localhost/boards/a1b2c3d4-e5f6-... \
  -H "Authorization: Bearer <accessToken>"
```

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-...",
    "name": "Q3 Roadmap",
    "ownerId": "user-uuid",
    "createdAt": "2026-05-18T10:00:00.000Z",
    "tasks": [
      {
        "id": "task-uuid",
        "title": "Build auth",
        "description": null,
        "status": "TODO",
        "priority": "HIGH",
        "boardId": "a1b2c3d4-...",
        "createdAt": "2026-05-18T10:01:00.000Z",
        "updatedAt": "2026-05-18T10:01:00.000Z"
      }
    ]
  }
}
```

---

#### `DELETE /boards/:id`

Delete a board and all its tasks (cascade).

| | |
|---|---|
| Auth | JWT required |
| Response | `204 No Content` |
| Errors | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 BOARD_NOT_FOUND`, `422 VALIDATION_ERROR` |

```bash
curl -X DELETE http://localhost/boards/a1b2c3d4-... \
  -H "Authorization: Bearer <accessToken>"
```

---

### Tasks

All task endpoints require a valid JWT access token. Users can only see and modify tasks that belong to their own boards. Task mutations (`POST`, `PATCH`, `DELETE`) publish events to the `tasks:events` Redis Stream.

#### `GET /tasks`

List all tasks across all boards owned by the authenticated user. Returns newest first.

| | |
|---|---|
| Auth | JWT required |
| Response | `200 OK` |
| Errors | `401 UNAUTHORIZED` |

```bash
curl http://localhost/tasks \
  -H "Authorization: Bearer <accessToken>"
```

```json
{
  "success": true,
  "data": [
    {
      "id": "task-uuid",
      "title": "Build auth",
      "description": "JWT + refresh rotation",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "boardId": "board-uuid",
      "createdAt": "2026-05-18T10:01:00.000Z",
      "updatedAt": "2026-05-18T11:00:00.000Z"
    }
  ]
}
```

---

#### `GET /tasks/:id`

Get a single task by ID.

| | |
|---|---|
| Auth | JWT required |
| Response | `200 OK` |
| Errors | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 TASK_NOT_FOUND`, `422 VALIDATION_ERROR` |

```bash
curl http://localhost/tasks/task-uuid \
  -H "Authorization: Bearer <accessToken>"
```

---

#### `POST /tasks`

Create a task on a board owned by the authenticated user.

| | |
|---|---|
| Auth | JWT required |
| Response | `201 Created` |
| Errors | `401 UNAUTHORIZED`, `403 FORBIDDEN` (board belongs to another user), `404 BOARD_NOT_FOUND`, `422 VALIDATION_ERROR` |

**Request body**

| Field | Type | Constraints | Default |
|---|---|---|---|
| `title` | string | 1–255 characters | — |
| `boardId` | string (UUID) | Must exist and be owned by the caller | — |
| `description` | string | Optional | `null` |
| `priority` | `"LOW"` \| `"MEDIUM"` \| `"HIGH"` | Optional | `"MEDIUM"` |

Unknown keys are rejected (`422`). `status` cannot be set on creation — new tasks always start as `TODO`.

```bash
curl -X POST http://localhost/tasks \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Design database schema",
    "description": "ERD for all models",
    "priority": "HIGH",
    "boardId": "board-uuid"
  }'
```

```json
{
  "success": true,
  "data": {
    "id": "new-task-uuid",
    "title": "Design database schema",
    "description": "ERD for all models",
    "status": "TODO",
    "priority": "HIGH",
    "boardId": "board-uuid",
    "createdAt": "2026-05-18T12:00:00.000Z",
    "updatedAt": "2026-05-18T12:00:00.000Z"
  }
}
```

---

#### `PATCH /tasks/:id`

Partially update a task. All fields are optional — supply only the fields to change.

| | |
|---|---|
| Auth | JWT required |
| Response | `200 OK` |
| Errors | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 TASK_NOT_FOUND`, `422 VALIDATION_ERROR` |

**Request body** (all fields optional)

| Field | Type | Constraints |
|---|---|---|
| `title` | string | 1–255 characters |
| `description` | string | |
| `status` | `"TODO"` \| `"IN_PROGRESS"` \| `"REVIEW"` \| `"DONE"` | |
| `priority` | `"LOW"` \| `"MEDIUM"` \| `"HIGH"` | |

`boardId` cannot be changed after creation. Unknown keys are rejected.

```bash
curl -X PATCH http://localhost/tasks/task-uuid \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_PROGRESS", "priority": "HIGH"}'
```

```json
{
  "success": true,
  "data": {
    "id": "task-uuid",
    "title": "Design database schema",
    "description": "ERD for all models",
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "boardId": "board-uuid",
    "createdAt": "2026-05-18T12:00:00.000Z",
    "updatedAt": "2026-05-18T13:00:00.000Z"
  }
}
```

---

#### `DELETE /tasks/:id`

Delete a task.

| | |
|---|---|
| Auth | JWT required |
| Response | `204 No Content` |
| Errors | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 TASK_NOT_FOUND`, `422 VALIDATION_ERROR` |

```bash
curl -X DELETE http://localhost/tasks/task-uuid \
  -H "Authorization: Bearer <accessToken>"
```

---

### Audit Logs

The audit log is written exclusively by the worker service — the API never writes to it directly. These endpoints provide read access to the caller's own log entries.

#### `GET /audit-logs`

List audit log entries for the authenticated user. Paginated, ordered newest first.

| | |
|---|---|
| Auth | JWT required |
| Response | `200 OK` |
| Errors | `401 UNAUTHORIZED`, `422 VALIDATION_ERROR` (invalid query params) |

**Query parameters**

| Parameter | Type | Constraints | Default |
|---|---|---|---|
| `limit` | integer | 1–100 | `20` |
| `offset` | integer | >= 0 | `0` |

```bash
curl "http://localhost/audit-logs?limit=10&offset=0" \
  -H "Authorization: Bearer <accessToken>"
```

```json
{
  "success": true,
  "data": [
    {
      "id": "log-uuid",
      "userId": "user-uuid",
      "action": "TASK_CREATED",
      "entity": "Task",
      "entityId": "task-uuid",
      "createdAt": "2026-05-18T12:00:01.000Z"
    }
  ]
}
```

**Action values**

| Action | Trigger |
|---|---|
| `TASK_CREATED` | `POST /tasks` succeeded |
| `TASK_UPDATED` | `PATCH /tasks/:id` succeeded |
| `TASK_DELETED` | `DELETE /tasks/:id` succeeded |

---

### Endpoint Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Liveness check |
| GET | `/ready` | Public | Readiness check (DB + Redis) |
| POST | `/auth/register` | Public | Register a new user |
| POST | `/auth/login` | Public | Login with email/password |
| POST | `/auth/refresh` | Public | Rotate refresh token |
| POST | `/auth/logout` | Public | Invalidate refresh token |
| GET | `/boards` | JWT | List caller's boards |
| POST | `/boards` | JWT | Create a board |
| GET | `/boards/:id` | JWT | Get board with tasks |
| DELETE | `/boards/:id` | JWT | Delete board (cascades tasks) |
| GET | `/tasks` | JWT | List all caller's tasks |
| GET | `/tasks/:id` | JWT | Get a single task |
| POST | `/tasks` | JWT | Create a task |
| PATCH | `/tasks/:id` | JWT | Partial update a task |
| DELETE | `/tasks/:id` | JWT | Delete a task |
| GET | `/audit-logs` | JWT | List caller's audit log entries |

---

## Authentication Flow

### Token types

| Token | Algorithm | TTL | Storage |
|---|---|---|---|
| Access token | `HS256`, signed with `JWT_SECRET` | 15 minutes | Client only (memory / local storage) |
| Refresh token | `HS256`, signed with `JWT_REFRESH_SECRET`, includes a `jti` claim | 7 days | Client + Redis (`refresh:<userId>:<jti>`) |

### Register / Login

1. Client sends credentials to `POST /auth/register` or `POST /auth/login`.
2. Server returns `{ accessToken, refreshToken }`.
3. Client attaches `accessToken` to every protected request: `Authorization: Bearer <token>`.

### Access token expiry

When the access token expires (after 15 minutes), the API returns `401 UNAUTHORIZED`. The client should:

1. `POST /auth/refresh` with the current `refreshToken`.
2. Server validates the refresh token, checks `refresh:<userId>:<jti>` in Redis, deletes the old key, issues a new token pair, and stores the new `jti` in Redis.
3. Client stores the new token pair and retries the original request with the new access token.

### Refresh token rotation and breach detection

Every call to `POST /auth/refresh` **invalidates the submitted token** and issues a brand-new one. If the same refresh token is submitted a second time (replay), the server detects that the Redis key no longer exists and returns `401`. The client must re-authenticate via login.

### Logout

`POST /auth/logout` deletes the refresh token's Redis key. The access token remains technically valid until its 15-minute TTL expires, but the refresh token can no longer be used to extend the session. Logout is idempotent.

---

## Redis Usage

| Purpose | Key pattern | TTL |
|---|---|---|
| Rate limiting (auth routes) | `rate:<ip>` | 900 seconds (15 minutes) |
| Refresh token store | `refresh:<userId>:<jti>` | 604800 seconds (7 days) |
| Task event stream | `tasks:events` (Redis Stream) | No expiry |
| Dead-letter queue | `tasks:events:dlq` (Redis Stream) | No expiry |

### Rate limiting

The `rateLimiter` middleware uses `INCR` + `EXPIRE` on a per-IP key. The window is 15 minutes with a ceiling of 100 requests. The middleware **fails open** — if Redis is unreachable, the request is passed through with a warning log rather than blocking traffic.

### Refresh tokens

On login or register, a UUID `jti` is generated and the key `refresh:<userId>:<jti>` is set in Redis with a 7-day TTL. On refresh, the key is looked up, deleted, and a new key is created for the newly issued token. This means only one refresh token per `jti` is ever valid at a time.

### Redis Streams (event-driven audit log)

Task mutations in the API publish to the `tasks:events` stream:

```
XADD tasks:events * payload '{"type":"task.created","taskId":"...","userId":"...","data":{...},"timestamp":"..."}'
```

The worker service consumes from this stream using a consumer group named `audit-group` and consumer `worker-1`. Event processing:

1. Worker polls with `XREADGROUP` — first drains any unACKed messages from the PEL, then blocks for new ones (`BLOCK 2000ms`).
2. On successful processing, the message is ACKed (`XACK`).
3. On handler failure, the failure count is incremented in memory. After 3 failures the message is moved to `tasks:events:dlq` and ACKed — it will not be retried further.
4. Unparseable messages (bad JSON, missing fields) are moved to the DLQ immediately on first encounter.

---

## Database Schema

PostgreSQL 16 managed by Prisma 5. All primary keys are UUIDs (generated by the application). Cascade deletes propagate down the ownership chain.

### Models

#### User

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` (UUID) | PK |
| `email` | `TEXT` | Unique |
| `password` | `TEXT` | bcrypt hash, cost 12 |
| `createdAt` | `TIMESTAMP` | Auto-set |

#### Board

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` (UUID) | PK |
| `name` | `TEXT` | |
| `ownerId` | `TEXT` (UUID) | FK → User (CASCADE DELETE) |
| `createdAt` | `TIMESTAMP` | Auto-set |

#### Task

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` (UUID) | PK |
| `title` | `TEXT` | |
| `description` | `TEXT` | Nullable |
| `status` | `TaskStatus` enum | `TODO` \| `IN_PROGRESS` \| `REVIEW` \| `DONE`, default `TODO` |
| `priority` | `Priority` enum | `LOW` \| `MEDIUM` \| `HIGH`, default `MEDIUM` |
| `boardId` | `TEXT` (UUID) | FK → Board (CASCADE DELETE) |
| `createdAt` | `TIMESTAMP` | Auto-set |
| `updatedAt` | `TIMESTAMP` | Auto-updated |

#### AuditLog

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` (UUID) | PK |
| `userId` | `TEXT` (UUID) | FK → User (CASCADE DELETE) |
| `action` | `TEXT` | `TASK_CREATED`, `TASK_UPDATED`, `TASK_DELETED` |
| `entity` | `TEXT` | Always `Task` |
| `entityId` | `TEXT` | ID of the affected task |
| `createdAt` | `TIMESTAMP` | Auto-set |

### Relationships

```
User (1) ──< Board (N) ──< Task (N)
User (1) ──< AuditLog (N)
```

Deleting a User cascades to all their Boards, which cascades to all Tasks on those Boards. Deleting a Board cascades to all its Tasks.

---

## Testing

The test suite is integration-level: real Supertest HTTP requests against the `createApp()` factory, a real PostgreSQL database, and a real Redis instance. The test database is isolated from the development database.

### Setup

Start the test infrastructure (PostgreSQL on port 5433, Redis on port 6380):

```bash
cd api
npm run test:up
```

This runs `docker compose -f ../docker-compose.test.yml up -d --wait` and applies migrations inside the test API container.

### Run tests

```bash
cd api

# Run the full suite (uses api/.env.test for DB/Redis URLs)
npm test

# Run with coverage report
npm run test:coverage
```

### Coverage thresholds

Jest is configured to enforce 80% line coverage and 80% branch coverage globally. The build fails if either threshold is not met.

### Tear down

```bash
cd api
npm run test:down
```

### Test structure

| File | Covers |
|---|---|
| `tests/auth.test.ts` | Register, login, refresh token rotation, logout, auth middleware |
| `tests/boards.test.ts` | Board CRUD, ownership isolation, 403/404 cases |
| `tests/tasks.test.ts` | Task CRUD, ownership isolation, validation, 403/404 cases |
| `tests/auditLogs.test.ts` | Audit log listing, pagination validation |
| `tests/health.test.ts` | `/health`, `/ready`, CORS enforcement, 404 catch-all |
| `tests/rateLimiter.test.ts` | Rate limit enforcement, edge cases, fail-open behavior (mocked Redis) |
| `tests/helpers.ts` | `cleanDb()` — wipes all tables + Redis flush between test suites |
| `tests/globalTeardown.ts` | Disconnects Prisma and Redis after the full suite |

---

## Logging

Pino structured JSON logging via `pino-http` for HTTP request logging and the `logger` singleton for application-level logs.

### Configuration

- **Development**: Pretty-printed output via `pino-pretty`
- **Production / Test**: Raw JSON (no transport)
- **Log level**: Controlled by the `LOG_LEVEL` env var (default `info`; set to `silent` in `.env.test`)

### Redacted fields

The following fields are replaced with `[REDACTED]` in all log output:

- `req.headers.authorization`
- `req.body.password`
- `req.body.token`
- `req.body.refreshToken`

The worker applies equivalent redaction to `event.data.password`, `event.data.token`, and `event.data.authorization`.

### Log format (production)

```json
{
  "level": 30,
  "time": 1716033600000,
  "pid": 1,
  "hostname": "api-container",
  "req": {
    "id": 1,
    "method": "POST",
    "url": "/auth/login",
    "headers": { "authorization": "[REDACTED]" }
  },
  "res": { "statusCode": 200 },
  "responseTime": 45,
  "msg": "request completed"
}
```

---

## Project Structure

```
flowboard/
├── docker-compose.yml          # Production compose: db, redis, api, worker, nginx
├── docker-compose.test.yml     # Test compose: isolated db (port 5433) and redis (port 6380)
│
├── nginx/
│   └── nginx.conf              # Reverse proxy: port 80 → api:3000
│
├── api/                        # Express API service
│   ├── Dockerfile              # Multi-stage: builder → production (node:22-alpine)
│   ├── .env.example            # Environment variable template
│   ├── .env.test               # Test environment (localhost ports for test infra)
│   ├── package.json
│   ├── tsconfig.json           # strict: true, target ES2022
│   │
│   ├── prisma/
│   │   ├── schema.prisma       # User, Board, Task, AuditLog models
│   │   ├── seed.ts             # Dev seed: 1 user, 2 boards, 4 tasks
│   │   └── migrations/         # SQL migration history
│   │
│   └── src/
│       ├── server.ts           # Entry point: app.listen + graceful shutdown
│       ├── app.ts              # createApp() factory: middleware stack + route mounting
│       ├── config.ts           # Zod-validated env schema (crashes on bad config)
│       │
│       ├── errors/
│       │   └── AppError.ts     # AppError class + global error handler middleware
│       │
│       ├── lib/
│       │   ├── prisma.ts       # Prisma singleton
│       │   ├── redis.ts        # ioredis singleton
│       │   ├── logger.ts       # Pino instance with redaction config
│       │   └── events.ts       # publishTaskEvent() → XADD tasks:events
│       │
│       ├── middleware/
│       │   ├── authenticate.ts # JWT Bearer token validation → req.user
│       │   └── rateLimiter.ts  # Redis-backed sliding window rate limiter
│       │
│       ├── schemas/
│       │   ├── authSchemas.ts  # Zod schemas for auth routes
│       │   ├── boardSchemas.ts # Zod schemas for board routes
│       │   └── taskSchemas.ts  # Zod schemas for task routes
│       │
│       ├── routes/
│       │   ├── health.ts       # GET /health, GET /ready
│       │   ├── auth.ts         # POST /auth/register|login|refresh|logout
│       │   ├── boards.ts       # GET|POST /boards, GET|DELETE /boards/:id
│       │   ├── tasks.ts        # GET|POST /tasks, GET|PATCH|DELETE /tasks/:id
│       │   └── auditLogs.ts    # GET /audit-logs
│       │
│       └── types/
│           └── express.d.ts    # req.user type augmentation
│
├── worker/                     # Redis Streams consumer service
│   ├── Dockerfile              # Multi-stage: builder → production (node:22-alpine)
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   │
│   ├── prisma/
│   │   └── schema.prisma       # Mirror of api schema (AuditLog write access)
│   │
│   └── src/
│       ├── index.ts            # Consumer loop: XREADGROUP, retry logic, DLQ
│       └── handlers/
│           ├── taskCreated.ts  # Writes TASK_CREATED AuditLog entry
│           ├── taskUpdated.ts  # Writes TASK_UPDATED AuditLog entry
│           └── taskDeleted.ts  # Writes TASK_DELETED AuditLog entry
```

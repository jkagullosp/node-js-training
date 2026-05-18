# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a Node.js training monorepo. Each `module-N` directory is a self-contained exercise or project — they do not share code or dependencies. The modules progress from raw JS fundamentals to a full TypeScript + Prisma API:

| Module | Topic |
|--------|-------|
| module-1 | JS fundamentals (variables, loops, functions) |
| module-2 | ES6 features (destructuring, spread, modules) |
| module-3 | Async JS (Promises, async/await, parallel execution) |
| module-4 | Node.js built-ins (fs, path, dates) + npm |
| module-5 | Raw HTTP servers (Node `http` module) |
| module-6 | Express basics |
| module-7 | Express middleware (cors, morgan, error handling) |
| module-8 | Prisma ORM with SQLite |
| module-9 | Testing with Jest + Supertest |
| module-10-capstone | Full REST API: Express + Prisma + Zod + Jest (JavaScript) |
| module-11 | TypeScript fundamentals |
| module-12 | TypeScript + Express |
| module-13 | TypeScript + Express + Prisma + Zod (notes & tags) |
| flowboard | Future capstone project |

## Commands

All commands must be run from inside the relevant module directory.

### JavaScript modules (6, 7, 8, 9, 10-capstone)

```bash
npm install
npm run dev        # nodemon auto-reload
npm start          # production run
npm test           # Jest
npm run test:coverage
```

### TypeScript modules (11, 12, 13)

```bash
npm install
npm run dev        # nodemon + ts-node (no build step required)
npm run build      # tsc → dist/
npm start          # node dist/server.js (requires build first)
```

### Database (modules 8, 10-capstone, 13)

```bash
cp .env.example .env          # first-time only (module-10-capstone)
npm run db:migrate             # prisma migrate dev
npm run db:studio              # Prisma Studio GUI
```

### Run a single Jest test file

```bash
npx jest path/to/file.test.js
```

## Architecture Patterns

### Module 10 capstone (JavaScript)

`createApp()` factory exported from `src/app.js` — the server entry (`src/server.js`) calls it, and tests import it directly without starting a server. Prisma client is a singleton in `src/db.js`; tests mock it with `jest.mock('../src/db', ...)`.

Validation uses Zod schemas defined in `src/middleware/validate.js`. Route handlers use Prisma error code `P2025` to detect not-found on update/delete.

Error shape throughout: `{ error: { status: <number>, message: <string> } }`.

### Module 13 (TypeScript)

Same structure as module-10 but in TypeScript. `src/app.ts` mounts `/notes` and `/tags` routers. `src/db.ts` exports the Prisma singleton. Zod schemas live in `src/schemas.ts`. `src/async-handler.ts` provides a wrapper to avoid try/catch boilerplate in route handlers. Prisma schema has a `Note → Tag` many-to-one relation (a note can have one optional tag; a tag can appear on many notes).

### Express version

All modules use **Express 5** (`^5.x`). Express 5 handles async route errors automatically (no need for explicit next(err) calls for thrown errors in async handlers).

## Environment Variables

Modules with databases use a `.env` file (not committed) with:
```
DATABASE_URL="file:./prisma/dev.db"
```

Module-10-capstone includes `.env.example` as a template.

## API Testing

Bruno collections (`.yml` files in `bruno/`) are included in modules 10-capstone and 13 for manual API testing. Import them into the Bruno desktop app.

# api/CLAUDE.md

Scoped guidance for the Express + Prisma API. The root [CLAUDE.md](../CLAUDE.md) and [AGENT.md](../AGENT.md) still apply; AGENT.md wins on any conflict.

## Layout

```
src/app.ts            Express app: middleware, router mounting, error handler
src/server.ts         listens on :3001
src/routes/*.ts       HTTP only: parse + validate input, call a service, map result → status
src/services/*.ts     business rules + ALL Prisma access
src/lib/prisma.ts     the single shared PrismaClient
prisma/schema.prisma  SQLite schema (applied with `prisma db push`, no migrations)
prisma/seed.ts        seed data
tests/unit/           service tests, no DB (mock lib/prisma)
tests/integration/    supertest against app.ts, real dev DB
```

Reference pair to copy: `routes/training-sessions.ts` → `services/trainingSessionService.ts`.

## Rules for this package

- **Routes never import `../lib/prisma`.** Add a service function instead. Known planted violations are `routes/admin.ts` (its own `PrismaClient`) and `GET /search` in `routes/training-sessions.ts`. Don't copy them, and don't "fix" them unless a story asks.
- **No `any`.** Type Prisma rows with the generated types and request bodies with an interface plus validation.
- **Domain errors → status codes in the route, not the service.** Services throw or return typed results (e.g. `NotFound`, `Full`). Routes map them to 400 / 404 / 409.
- **Counters and capacity checks must be atomic.** Use `prisma.$transaction` when you read `registered` and then write it (race condition called out in LATC-2).
- **New router?** Mount it in `src/app.ts` under `/api/...`.
- Schema changes: edit `schema.prisma`, then run `pnpm exec prisma db push && pnpm exec prisma generate`. Never add migration files.

## Tests

```bash
pnpm exec jest tests/unit                       # fast, no DB
pnpm exec jest tests/integration/<file>.test.ts # one integration file
pnpm exec jest -t "<test name>"                 # one test
```

- Integration tests share `database/workshophub.sqlite` with `make dev`. **Clean up every row you create** (`afterEach`/`afterAll`). If the data drifts, run `make reset-db`.
- `--runInBand` is required. Don't parallelise integration tests.
- Test first (red → green), following the SPDD prompt's Operations order.

## Done for an API change

`make test && make lint && make format-check` all pass, and the endpoint's status codes match the story's acceptance criteria exactly.

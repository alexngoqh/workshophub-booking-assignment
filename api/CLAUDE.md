# api/CLAUDE.md

Scoped guidance for the Express + Prisma API. The root [CLAUDE.md](../CLAUDE.md) and [AGENT.md](../AGENT.md) still apply; AGENT.md wins on any conflict.

## Layout

```
src/app.ts                     Express app: middleware, router mounting, error handler
src/server.ts                  listens on :3001
src/routes/*.ts                HTTP only: parse + validate input, call a service, map result → status
src/services/registrationService.ts   register / cancel+promote / lookup / list / audit history
src/services/trainingSessionService.ts
src/notifications/index.ts     fire-and-forget notifications (after commit, never awaited)
src/lib/prisma.ts              the single shared PrismaClient
prisma/schema.prisma           TrainingSession, Registration, AuditLog (db push, no migrations)
tests/unit/                    no DB; mock lib/prisma
tests/integration/             supertest against app.ts on a dedicated test DB
tests/integration/helpers.ts   createTestSession / deleteTestSessions
tests/integration/faultInjection.ts   forces mid-transaction failures for atomicity tests
```

Reference pair to copy: `routes/registrations.ts` → `services/registrationService.ts`.

## Rules for this package

- **Routes never import `../lib/prisma`.** Add a service function instead. The planted violations are `routes/admin.ts` (its own `PrismaClient`) and `GET /search` in `routes/training-sessions.ts` (raw SQL). Don't copy them, and don't fix them unless a story asks.
- **Every status change happens in one transaction together with:**
  - the `registered` counter update (it counts **confirmed** seats only), and
  - an `AuditLog` row (`fromStatus → toStatus`).

  If one of the three is missing, the atomicity tests should fail. Keep them that way.

- **Notifications are sent after the commit and never awaited.** A notification failure must never change the HTTP response.
- **Statuses:** only `confirmed | waitlisted | cancelled`. Promotion takes the oldest `waitlisted` registration by `createdAt`.
- **Deadline:** registering after `registrationDeadline` (server time, UTC) returns 422.
- **No `any`.** Use Prisma's generated types, and `unknown` plus narrowing for request bodies.
- Schema changes: edit `schema.prisma`, then `pnpm exec prisma db push && pnpm exec prisma generate`. Never add migration files.

## Tests

```bash
pnpm exec jest tests/unit                       # fast, no DB
pnpm exec jest tests/integration/<file>.test.ts # one file
pnpm exec jest -t "<test name>"                 # one test
```

- `tests/globalSetup.ts` force-resets and seeds a **dedicated** test DB (`database/workshophub-test.sqlite?connection_limit=1`) once per run. It is not the dev DB. Set `DATABASE_URL` to override it.
- `--runInBand` is set in `package.json`. Don't parallelise.
- Create data with `createTestSession` and clean it up with `deleteTestSessions`. Never change seed rows.
- New state transitions need an atomicity test using `faultInjection.ts`.

## Done for an API change

`make test && make lint && make format-check` all pass, and status codes and bodies match the story's acceptance criteria and the matching spec in `openspec/specs/`.

# WorkshopHub — Project Briefing

**Read this first.** A short orientation to the WorkshopHub codebase.
For: new contributors and AI agents picking up work here. It complements
`README.md` (the full setup manual) and `AGENT.md` (agent norms + boundaries).
When this brief and the running code disagree, **trust the code**.

---

## 1. What it is

WorkshopHub is an internal training-registration system. Employees browse the
list of internal training sessions and register for one. This repository is the
baseline codebase template for a 3-day AI-assisted software-delivery training —
so some features are implemented end-to-end, while others are intentionally left
as exercises. Treat the running code as the source of truth, not any "to-do"
list in prose.

## 2. The system in one picture

Two runnable pieces, plus a test package, wired together as a pnpm monorepo:

```
   app/  (React + Vite, browser)   ──HTTP──▶   api/  (Express)  ──Prisma──▶  SQLite
   @workshophub/app                            @workshophub/api
   e2e/  (Playwright) ────────────────────────── end-to-end checks
```

| Package              | Path   | Stack                                       |
| -------------------- | ------ | ------------------------------------------- |
| `@workshophub/app`   | `app/` | React 18 + TypeScript + Vite 5 (frontend)   |
| `@workshophub/api`   | `api/` | Node 24 + TypeScript + Express + Prisma     |
| `@workshophub/e2e`   | `e2e/` | Playwright end-to-end tests                 |

**Ports.** Dev: frontend `5173`, API `3001`. Prod (Docker): `8080`. Dev and prod
use separate ports, so both can run locally at once.

## 3. The data model

SQLite, described in `api/prisma/schema.prisma`. Three models:

| Model           | Key facts |
| --------------- | --------- |
| `TrainingSession` | `title`, `date`, `capacity`, `registered` (counter), `location`, `deliveryMode`, `status`, `registrationDeadline` (nullable) |
| `Registration`    | `sessionId`, `name`, `email`, `status` ∈ `confirmed \| waitlisted \| cancelled`; indexed on `[sessionId, email]` and `[sessionId, status]` |
| `AuditLog`        | immutable history of a registration's status transitions (`fromStatus` → `toStatus`, `reason`) |

Behaviour worth knowing before you touch this area:

- **Seats are claimed with a conditional `updateMany`** (`registered < capacity`),
  so two concurrent requests can never both take the last seat. When full, the
  new registration is **waitlisted** (1-based position by id).
- **Server time is authoritative** for the registration deadline (client time is
  not trusted).
- **Cancelling a confirmed seat promotes** the earliest waitlisted registration;
  otherwise the seat counter is decremented.
- **Every status change writes an `AuditLog` row** inside the same transaction.
  Audit entries are immutable through the API (read-only endpoint).

## 4. How a request flows (architecture)

```
routes/  ──▶  services/  ──▶  lib/prisma.ts
(handler)     (logic + DB)    (shared PrismaClient)
```

- **Routes** (`api/src/routes/`) parse and validate input, then delegate to a
  service. They own HTTP status codes and response shape, nothing else.
- **Services** (`api/src/services/`) own the business rules and all database
  access. `registrationService.ts` is the reference — it wraps multi-step
  mutations in `prisma.$transaction` and returns a discriminated-union result
  (e.g. `confirmed | waitlisted | duplicate | deadline_passed`).
- **Notifications** (`api/src/notifications/`) are **fire-and-forget**: `notify()`
  never throws and never blocks the caller; failures are logged and swallowed so
  a broken transport cannot fail a registration. It has test hooks
  (`setTransportsForTesting`, `flushNotifications`).
- **Frontend** talks to the API through a typed client (`app/src/api.ts`) that
  returns an `ApiResult<T>` — no `any`, no raw `fetch` scattering.

**Known exceptions (planted/baseline shortcuts — do not copy these):**

- `GET /api/training-sessions/search` calls `prisma.$queryRawUnsafe` directly in
  the route (see `routes/training-sessions.ts`).
- `GET /api/admin/sessions` instantiates its own `PrismaClient` and runs a query
  in the route, with a `// TODO: restrict to authenticated users` marker
  (`routes/admin.ts`).

Both violate the "no direct Prisma in routes" norm and exist to be found and
fixed during the workshop. The fix is always: move the query into a service and
import the **shared** client from `lib/prisma.ts`, never instantiate a new one.

## 5. Build, run, test

The `Makefile` is the stable command interface — prefer `make` over raw
`pnpm`/`docker`. `make help` lists every target.

| Command                | What it does |
| ---------------------- | ------------ |
| `make setup`           | Install deps, generate Prisma client, push schema, seed |
| `make dev`             | Run frontend (`5173`) + API (`3001`) together |
| `make test`            | Run unit + integration tests |
| `make test-unit`       | Unit tests only (no database needed) |
| `make lint`            | ESLint across `app` and `api` |
| `make format-check`    | Prettier check across all packages |
| `make build`           | Build frontend + backend |
| `make seed` / `make reset-db` | Seed / force-reset and re-seed |
| `make smoke-test`      | Validate a running app (default port `3001`) |

**The gate.** A change is not done until `make test` and `make lint` are green.
The pre-push hook also runs `format-check` and a security scan; CI
(`.github/workflows/pr-check.yml`) runs test + lint + format-check. Run them
locally before pushing.

## 6. Team norms (non-negotiables)

Full detail and the agent boundary live in `AGENT.md`. In short:

- **No `any`.** Prefer an explicit type, a real interface, or `unknown` with a
  guard. `@typescript-eslint/no-explicit-any` is on everywhere (`error` in
  `app`, `warn` in `api` — treat as error).
- **No direct Prisma in routes.** Routes → services → `lib/prisma`. Never import
  `@prisma/client` in a route, and never instantiate a new `PrismaClient`.
- **Everything must pass `make test` and `make lint`** (and `format-check`).
- **No secrets, `.env`, or generated artifacts** (`dist/`, `database/`) committed.

## 7. What's in the box

Implemented end-to-end (verified in the current code): session listing and lookup;
the full registration lifecycle — register, waitlist with position, duplicate
prevention, deadline enforcement, cancel with waitlist promotion; per-registration
audit history; and fire-and-forget notifications. The training also seeds a few
deliberate issues (e.g. the two routes in §4) to be discovered and hardened —
don't assume any "not implemented" list in older docs is still accurate.

## 8. Where to go next

- **Full setup manual / troubleshooting** → `README.md`
- **Agent norms, MCP permissions, and the action boundary** → `AGENT.md`
- **Story exports / offline reference** → `docs/`
- **Trainee setup & teardown** → `setup/`
- **Schema** → `api/prisma/schema.prisma`

_Keep this brief current. It should stay short enough to read in one sitting;
push detail into `README.md`, `AGENT.md`, or `docs/` and link it from here._

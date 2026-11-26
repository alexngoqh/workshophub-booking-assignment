# SPDD Analysis: Admin route uses the service layer instead of its own PrismaClient

## Original Business Requirement

# LATC-150 — Admin route uses the service layer instead of its own PrismaClient — Alex Ngo

## Acceptance criteria

- [ ] `api/src/routes/admin.ts` does not import `@prisma/client` or `lib/prisma`, and does not create a `PrismaClient`
- [ ] The query moves into a function in `api/src/services/` that uses the shared client from `lib/prisma.ts`
- [ ] The admin endpoint's HTTP behaviour does not change: same path, same status codes, same response body shape and ordering
- [ ] `api/src/routes/admin.ts` is removed from `scripts/no-prisma-in-routes.allow`, and `make sensors` is green
- [ ] Unit and integration tests prove the service function and the endpoint behaviour

## Out of scope

- The `GET /search` exemption in `routes/training-sessions.ts`
- Any new admin features, authentication, or changes to the response

## Domain Concept Identification

### Existing Concepts (from codebase)
- **Admin sessions listing** (`GET /api/admin/sessions`, mounted in `api/src/app.ts`): returns every `TrainingSession` row as stored, ordered by `date` ascending; 500 with `{ error: 'Failed to fetch sessions' }` on failure. Currently creates its own `PrismaClient` in the route — the planted anti-pattern.
- **TrainingSession**: the Prisma model; the admin endpoint exposes its raw columns (including the denormalised `registered` counter) with no derived fields.
- **trainingSessionService** (`api/src/services/trainingSessionService.ts`): already owns session reads (`getAllSessions`, `getSessionById`) via the shared client, but these add a flattened `waitlisted` count — a different response shape from the admin endpoint.
- **Shared Prisma client** (`api/src/lib/prisma.ts`): single client with tuned transaction options; the only sanctioned Prisma entry point.
- **no-prisma-in-routes sensor** (`scripts/no-prisma-in-routes.sh` + `.allow`): enforces "no Prisma in routes"; `admin.ts` is a documented exemption that this card retires.

### New Concepts Required
- **Admin session read in the service layer**: a service-level function returning all sessions in raw shape, date-ascending — the route delegates to it.

### Key Business Rules
- Response contract is frozen: same path, status codes, body shape (raw rows, no `waitlisted`), ordering by `date` asc, same error body.
- Routes never touch Prisma (AGENT.md norm); all data access via services on the shared client.
- Exemption allowlist entries are debt; removing one must leave the sensor green.

## Strategic Approach

### Solution Direction
- Route → service → shared client, mirroring `registrations.ts` → `registrationService.ts`. Move the findMany into a service function; the route keeps only HTTP mapping (200 JSON / 500 error). Then remove the `admin.ts` line from the allowlist and verify with `make sensors`.

### Key Design Decisions
- **Where the function lives**: add to existing `trainingSessionService` (cohesive with other session reads, existing unit-test mocking pattern) vs. a new `adminService` (clearer ownership, but one-function module). → Add to `trainingSessionService`.
- **Reuse `getAllSessions`?**: would be less code but adds `waitlisted` and changes body shape, violating AC3. → New dedicated function returning raw rows; do not reuse.
- **Testing**: unit test mocking `lib/prisma` (existing pattern in `tests/unit/trainingSessionService.test.ts`) + integration test via supertest against `/api/admin/sessions` asserting 200, raw shape (no `waitlisted`), date ordering, using `createTestSession()`.

### Alternatives Considered
- Passing the shared client into the route / importing `lib/prisma` in the route: still Prisma in routes, fails AC1 and the sensor.
- Adding authentication while touching the route (there is a TODO): explicitly out of scope.

## Risk & Gap Analysis

### Requirement Ambiguities
- "Same response body shape" — interpreted as raw TrainingSession rows with all columns, no derived fields; dates serialised as ISO strings as today.
- Error-path test: the 500 branch is part of the contract; whether integration tests must cover it (requires mocking the service) is not stated — recommend covering it at unit/route level via jest mock.

### Edge Cases
- Empty table → `[]` with 200 (unchanged).
- Sessions with equal dates — ordering among ties is unspecified today; do not assert tie order.
- Integration tests share the test DB with seed data; assert on created sessions' relative order rather than the full list.

### Technical Risks
- Removing the route's own client changes connection lifecycle (one fewer client) — benign, positive.
- Accidentally using `include: withWaitlistCount` changes shape — guarded by an integration test asserting no `waitlisted` key.
- Sensor regex might also match a `lib/prisma` import in the route — route must import only from the service.

### Acceptance Criteria Coverage
| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | admin.ts has no Prisma import/client | Yes | Route imports only the service |
| 2 | Query moves to a service using shared client | Yes | New function in trainingSessionService |
| 3 | HTTP behaviour unchanged | Yes | Must not reuse getAllSessions (adds `waitlisted`) |
| 4 | Allowlist line removed, `make sensors` green | Yes | Leave training-sessions.ts line (out of scope) |
| 5 | Unit + integration tests | Yes | Unit via mocked prisma; integration via supertest |

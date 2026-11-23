# SPDD Analysis: Employee Registers for an Available Training Session (LATC-2)

> Source: Jira LATC-2 (Story, Backlog), fetched via the Atlassian MCP connector. Working copy: LATC-16.
> Generated with `.claude/commands/spdd-analysis.md` (re-run 2026-11-23 14:14). Analysed against branch `latc-2-register-day4`, based on `b2405f9` Initial commit (LATC-1 only). No registration code exists yet.
> The untracked `openspec/` folder in the working tree is left over from `main` and contains finished solutions. It was deliberately **not** used for this analysis.

## Original Business Requirement

_Migrated from WH-2_

### Context

Employees can currently browse training sessions (WH-1). The next step is allowing them to register. Registration is the core transactional action of WorkshopHub — it increments the `registered` count on a session and records the employee's details.

This is a **trainee exercise story**. It is not implemented in the baseline template.

### Description

As an employee, I want to register for an available training session so that I can secure my place before it fills up.

An employee submits their name and email to register. The system confirms the registration and shows the updated capacity. If the session is full, the employee cannot register (see WH-3 for the waitlist).

### Acceptance Criteria

- A register button or form is visible on each session card (or session detail page)
- The employee provides their name and email to register
- On success, the `registered` count increments by 1
- On success, a confirmation message is shown to the employee
- If `registered >= capacity`, the register button is disabled or hidden
- `POST /api/training-sessions/:id/registrations` accepts `{ name, email }` and returns HTTP 201 with registration details
- Returns HTTP 400 if required fields are missing
- Returns HTTP 409 if the session is full (see WH-3 for waitlist)
- Returns HTTP 404 if the session does not exist

### Out of Scope

- Duplicate registration prevention
- Waitlist behaviour when full (WH-3)
- Cancellation (WH-4)
- Email notification (WH-8)
- Authentication or SSO

### Suggested Tests

- `POST /api/training-sessions/1/registrations { name, email }` → 201
- `POST /api/training-sessions/1/registrations {}` → 400, missing fields
- `POST /api/training-sessions/999/registrations` → 404
- `POST` when session is full → 409
- `registered` count increments after successful registration

### Notes

The `Registration` model will need to be added to the Prisma schema. Consider whether `registered` count is stored on the session row or computed from the registrations table.

Need to consider the race condition when creating a registration and incrementing the count.

---

## Domain Concept Identification

### Existing Concepts (from codebase)

- **TrainingSession**: a scheduled workshop with a `capacity` and a stored `registered` counter (default 0; every seed row starts at 0). It also has a `status` (default `"active"`) that nothing in the baseline reads yet. Served by `GET /api/training-sessions` and `GET /api/training-sessions/:id` through `trainingSessionService`.
- **Session card (UI)**: `TrainingSessionCard` already works out "spots left" and "full" from `registered` and `capacity`, shows a "Full" badge, and renders "X / Y registered". It is display-only: there is no action and no state.
- **Session list page**: `TrainingSessionsPage` fetches sessions with an inline `fetch` call. There is no shared HTTP client module yet.

### New Concepts Required

- **Registration**: an employee's claim on one session, identified by name and email (no user account). Belongs to exactly one TrainingSession. A session has many registrations. Within LATC-2 a registration is always a successful, confirmed seat. There is no status lifecycle yet: that arrives with LATC-3 (waitlist) and LATC-4 (cancel).
- **Seat claim**: not a stored entity. It is the operation that checks for a free seat and takes it as one atomic step. This is where the ticket's race-condition note applies.
- **Registration input validation**: the rule set for name and email. This is the first write endpoint in the codebase, so there is no validation convention to copy yet.
- **Registration form / confirmation (UI)**: the register action, a form for name and email, a success message, and the card's count updated without a page reload.

### Key Business Rules

- **Capacity invariant**: `registered` must never exceed `capacity`, including when requests arrive at the same time. _(TrainingSession)_
- **Counter consistency**: when the counter is stored, `registered` must equal the number of registrations for the session. The increment and the new registration row must succeed or fail together. _(TrainingSession ↔ Registration)_
- **Required input**: name and email must both be present and not blank. _(Registration)_
- **Full means reject**: if `registered >= capacity`, the request fails with 409 and nothing changes. _(TrainingSession)_
- **Unknown session**: 404, and nothing is created. _(TrainingSession)_
- **Implicit: the existing ID convention**: `GET /:id` returns 400 for a non-numeric id. A new nested route should probably follow the same convention. The ACs don't say so.
- **Implicit: email format**: the ACs only require the email to be present. Whether a malformed email is rejected has not been decided.

---

## Strategic Approach

### Solution Direction

- Add a **Registration** model that relates to TrainingSession, then follow the reference layering exactly: a new `routes/registrations` router (validates input, maps outcomes to 201/400/404/409) → a new `services/registrationService` (owns the transaction and all Prisma access) → the shared `lib/prisma` client.
- Data flow: validate the request → in one transaction [does the session exist? → is a seat free? → claim the seat atomically → create the registration] → respond with the registration details and the updated count.
- On the frontend: the card gains a register action and a name/email form. It shows a confirmation and updates its own count from the response. When the session is full, the action is disabled or hidden. The card already has `isFull`, so this mostly reuses existing logic.
- Tests: integration tests with Supertest for every status code in the ACs, plus a concurrency test for the last seat. Following AGENT.md, write the tests first.

### Key Design Decisions

- **Stored vs computed `registered`** (ticket note). A stored counter is already in the schema, already used by the UI and seed data, and cheap to read, but it must be kept in sync carefully. A computed count is always correct, but every list read becomes a COUNT, and the "is a seat free?" check becomes harder to make atomic. → **Keep the stored counter**, and update it in the same transaction as the insert.
- **Race-safe seat claim** (ticket note). Options: (a) read the count, then write; (b) a single conditional increment that only succeeds while `registered < capacity`; (c) a serialisable transaction or locks. SQLite has no row locks, and (a) is racy. → **(b) conditional increment inside a transaction.** If the update affects 0 rows, the session is full (409). Then create the row in the same transaction.
- **Where the register UI lives**: the AC allows the card or a detail page, and the baseline has no detail page or router. → **Put it on the card.** This avoids adding routing in a story that doesn't need it.
- **Shape of the 201 response**: "registration details" isn't defined. → Return the registration (id, sessionId, name, email, createdAt) together with the session's updated `registered` and `capacity`, so the UI can update without fetching again. Confirm this in the Canvas phase.
- **Normalising input**: trimming name and email, and lower-casing email, costs almost nothing now. Duplicate detection (a later story) depends on it. → Normalise on write. Detecting duplicates stays out of scope.

### Alternatives Considered

- **Compute `registered` from the registrations table**: rejected, because it would change the existing read paths and seed data, and it makes the capacity check harder to keep atomic.
- **Check capacity first, then increment as a separate step**: rejected, because it is racy and two requests could take the last seat.
- **Add a session detail page and a router for the form**: rejected for this story, because the card is enough and the ACs allow it.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **"Registration details" in the 201 body** has no defined fields.
- **"Shows the updated capacity"**: does it mean "X / Y registered", or spots left? The card already shows both, so the card's count updating should be enough.
- **Disabled or hidden** when full: either is allowed. Pick one. Disabled with the existing "Full" badge communicates more.
- **Malformed email**: the ACs only cover missing fields. Decide whether an invalid email also returns 400.
- **Inactive sessions** (`status` ≠ `active`): not mentioned. Should registration be rejected?

### Edge Cases

- **Two requests for the last seat at the same time**: exactly one should get 201 and the other 409. This is the core risk the ticket calls out.
- **Whitespace-only name or email**: should count as missing (400).
- **Non-numeric session id** (for example `/abc/registrations`): 400 or 404? The existing `GET /:id` returns 400.
- **Session in the past**: not mentioned. Registration closing is a later story (LATC-7 deadline).
- **The same person registering twice**: explicitly out of scope, so both registrations count toward capacity. Document this so nobody "fixes" it by accident.

### Technical Risks

- **Tests share the dev database** (`tests/setup.ts` points at `workshophub.sqlite`). Registration tests will change `registered` on seed sessions, which affects the running app and makes test order matter. Mitigation: tests create and clean up their own sessions, or point Jest at a separate test database.
- **Concurrency on SQLite**: concurrent write transactions can fail with "database is locked" instead of waiting. A concurrency test may be flaky unless the busy timeout or transaction timeout is generous.
- **Counter drift**: any later code path that inserts or removes registrations without adjusting `registered` in the same transaction breaks the invariant. This sets the pattern for LATC-3 and LATC-4.
- **No frontend HTTP client**: the list page uses an inline `fetch`. Adding a second call directly in the component spreads that pattern. Consider a small shared client.
- **Planted issues nearby**: `GET /search` uses raw SQL and is injectable, and `routes/admin.ts` creates its own Prisma client. Don't copy either into the new route.

### Acceptance Criteria Coverage

| AC# | Description                                              | Addressable? | Gaps/Notes                                                    |
| --- | -------------------------------------------------------- | ------------ | ------------------------------------------------------------- |
| 1   | Register button/form on session card or detail page      | Yes          | On the card; no detail page in the baseline                   |
| 2   | Employee provides name and email                         | Yes          | Email format rule undecided                                   |
| 3   | On success `registered` increments by 1                  | Yes          | Atomic with the insert                                        |
| 4   | Confirmation message shown on success                    | Yes          | Wording not specified                                         |
| 5   | `registered >= capacity` → button disabled/hidden        | Yes          | The card already computes `isFull`; choose disabled or hidden |
| 6   | `POST …/registrations` `{name,email}` → 201 with details | Yes          | Body fields to be defined                                     |
| 7   | 400 when required fields missing                         | Yes          | Also decide on blank values and a malformed email             |
| 8   | 409 when session is full                                 | Yes          | Must hold under concurrent requests                           |
| 9   | 404 when session does not exist                          | Yes          | Non-numeric id: 400 vs 404 to decide                          |

**Coverage: 9/9 addressable.** Open questions/risks: 6 (201 body, email format, inactive sessions, non-numeric id, shared test DB, SQLite concurrency).

# SPDD Analysis: Registration deadline prevents late registration

> Story LATC-7, worked on replica card LATC-148 (branch `latc-148-registration-deadline`).
> **Status finding:** the story is already fully implemented on `main`. This analysis records the existing implementation against the ACs so the REASONS Canvas can describe it, not redesign it.

## Original Business Requirement

# LATC-7 — Registration deadline prevents late registration

- **Original card:** LATC-7 (status: Backlog, untouched)
- **Working copy:** LATC-148 Registration deadline prevents late registration — Alex Ngo (already In Progress, left as is)
- **Kicked off:** 2026-11-26 by Alex Ngo via /kickoff
- **Base:** `main`
- **Branch:** `latc-148-registration-deadline`

Note: the story is already implemented on `main`; this run follows the SPDD flow against the existing implementation.

## Acceptance criteria

**User interactions:**

- [ ] When a session has a deadline in the future, the session card shows "Registration closes: [formatted date]" near the Register button
- [ ] When the deadline has passed, the session card shows "Registration closed" in place of the Register button
- [ ] The Register button is removed or disabled when the deadline has passed
- [ ] If a user submits the registration form after the deadline (e.g. page open before cutoff), they see an inline error: "Registration for this session has closed"
- [ ] Sessions without a deadline show no deadline label and allow registration at any time

**API behaviour:**

- [ ] `TrainingSession` has a `registrationDeadline` field (nullable `DateTime`)
- [ ] `POST /api/training-sessions/:id/registrations` returns HTTP 422 if the current time is after `registrationDeadline`
- [ ] The error body includes `{ error: "Registration deadline has passed" }`
- [ ] Sessions without a deadline allow registration at any time
- [ ] The deadline check uses server time (not client time)

## Out of scope

- Organiser UI for setting the deadline (seed data is sufficient)
- Automatic session status change at deadline
- Timezone handling beyond UTC

## Domain Concept Identification

### Existing Concepts (from codebase)

- **TrainingSession**: a bookable session with capacity and a denormalised `registered` counter. Already carries a nullable `registrationDeadline` (Prisma schema, documented as a UTC instant; null means no deadline). Owns its Registrations.
- **Registration**: an employee's booking, in state `confirmed | waitlisted | cancelled`. Creation is the only transition the deadline governs.
- **Registration register flow** (`registrationService.registerForSession`): one transaction that looks up the session, checks the deadline, checks duplicates, claims a seat or waitlists, and writes the AuditLog. It already returns a `deadline_passed` result, which the route maps to 422 with the required error text.
- **AuditLog**: written only for real status transitions. A rejected registration writes no row (per the registration-audit spec).
- **Session card / RegistrationPanel / RegistrationForm** (frontend): show "Registration closes: ..." for a future deadline, "Registration closed" instead of the Register/Join waitlist button once passed, and map a 422 from the server to "Registration for this session has closed".
- **Seed data**: creates one session with a deadline 14 days ahead and one with a deadline a day ago, relative to seed time, so both states can be demoed.
- **OpenSpec**: `openspec/specs/registrations/spec.md` ("Reject registration after the deadline", "Closed registration in the UI") and `openspec/specs/training-sessions/spec.md` ("Show the registration deadline on the card") already specify this behaviour.

### New Concepts Required

- None. Every concept the story needs exists in code, spec and tests.

### Key Business Rules

- **Server clock is authoritative**: the cut-off is evaluated against server time inside the register transaction; the client's check is display-only. Governs TrainingSession, Registration.
- **Strictly after**: a registration exactly at the deadline instant is allowed; one millisecond later is rejected (covered by an integration test).
- **Applies to the waitlist too** (implicit rule surfaced): a full session past its deadline also rejects with 422 rather than waitlisting.
- **Rejection has no side effects**: no Registration created, `registered` unchanged, no AuditLog row, no notification.
- **Input validation precedes the deadline check**: an invalid body still gets 400, not 422.
- **Null deadline means always open**.
- **Cancellation is not affected** by the deadline (not stated in the story; current behaviour allows cancelling and waitlist promotion after the deadline).

## Strategic Approach

### Solution Direction

- No new design. Follow the existing layering: route parses and validates → `registrationService` enforces the deadline inside the register transaction → route maps the `deadline_passed` result to 422. The frontend reads `registrationDeadline` from the session payload for display and relies on the server's 422 for enforcement.
- The SPDD flow for this card should produce a canvas that documents the existing implementation and confirms the tests cover each AC; `/spdd-generate` is expected to be a verification pass with no code change unless a gap below is chosen for fixing.

### Key Design Decisions

- **Where to enforce the deadline**: in the service, inside the transaction (current) vs. in the route. Service keeps business rules out of routes per AGENT.md and makes it testable with an injected `now` → keep as is.
- **Injected clock**: the service takes an optional `now`, defaulting to server time. This allows deterministic boundary tests without mocking the clock → keep.
- **Hide vs. disable the button**: the UI hides the button and shows "Registration closed" (AC allows either) → keep hiding; it is clearer and matches the spec.
- **Mapping 422 in the client**: the form treats any 422 as "closed". Simple and correct today because the deadline is the only 422 the API returns → keep, but note the coupling (see risks).

### Alternatives Considered

- **Automatic session status change at deadline (e.g. a scheduled job)**: out of scope by the story, and unnecessary since the check is evaluated per request.
- **Client-side enforcement only**: rejected; the AC requires server time and the client clock cannot be trusted.
- **Storing deadline as a date without time / local timezone**: rejected; the story scopes to UTC and the schema stores an instant.

## Risk & Gap Analysis

### Requirement Ambiguities

- **"After the deadline" boundary**: the story says "after"; implementation treats the exact instant as still open. Consistent with the wording; documented by a test.
- **Waitlist after the deadline**: the story does not say whether joining a waitlist is also blocked. Implementation and spec block it. Accepted as the intended interpretation.
- **Cancellation/promotion after the deadline**: not addressed. Current behaviour allows cancelling and promotes the oldest waitlisted registration even after the deadline. Left unchanged; flag to product if this is not desired.
- **Date formatting**: "[formatted date]" is not specified; the UI uses the existing `formatDateTime` helper in the viewer's locale/timezone, while the cut-off is UTC on the server.

### Edge Cases

- **Page open across the cut-off**: the card still shows the open form until reload; the server rejects and the form shows the inline error. Covered by the AC and the e2e spec `e2e/tests/latc-7-deadline.spec.ts`.
- **Client clock skew**: the label may show "open" or "closed" slightly wrong near the boundary; enforcement is server-side, so data stays correct.
- **Already-registered user after the deadline**: the panel shows their active registration, not the closed label; cancellation remains possible.
- **Seed deadlines are relative to seed time**: after 14 days without reseeding, the "open" demo session will appear closed.

### Technical Risks

- **422 coupling in the client**: `RegistrationForm` maps every 422 to the "closed" message. If another 422 is added later, users would see a misleading message. Low risk now (the deadline is the only 422 in `api/src`); mitigation would be matching on the error body.
- **Concurrency**: the deadline check is a read inside the same transaction as the seat claim, so there is no race that lets a late registration through beyond normal request timing.
- **No schema change needed**: the field already exists, so there is no `prisma db push` risk.

### Acceptance Criteria Coverage

| AC# | Description                                                                 | Addressable?      | Gaps/Notes                                                                   |
| --- | --------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| 1   | Future deadline shows "Registration closes: [formatted date]" near Register | Yes (implemented) | `RegistrationPanel`; e2e `latc-7-deadline.spec.ts`                           |
| 2   | Passed deadline shows "Registration closed" in place of Register            | Yes (implemented) | `RegistrationPanel`                                                          |
| 3   | Register button removed or disabled after deadline                          | Yes (implemented) | Button is hidden; also applies to Join waitlist                              |
| 4   | Late submit shows inline "Registration for this session has closed"         | Yes (implemented) | `RegistrationForm` maps 422; see coupling risk                               |
| 5   | No deadline: no label, registration any time (UI)                           | Yes (implemented) | OpenSpec scenario "No deadline" on the card                                  |
| 6   | `TrainingSession.registrationDeadline` nullable DateTime                    | Yes (implemented) | Prisma schema; exposed in session payloads (integration test)                |
| 7   | POST registrations returns 422 after deadline                               | Yes (implemented) | Service `deadline_passed` → route 422; integration tests                     |
| 8   | Error body `{ error: "Registration deadline has passed" }`                  | Yes (implemented) | `routes/registrations.ts`                                                    |
| 9   | No deadline allows registration any time (API)                              | Yes (implemented) | Integration test "allows registration at any time when there is no deadline" |
| 10  | Deadline check uses server time                                             | Yes (implemented) | Server `now` in service; boundary test at exact instant and +1ms             |

All 10 ACs are already met on `main`; no open gaps block the canvas. Open questions for product (non-blocking): cancellation/promotion after the deadline, and whether the client should match on the error body rather than status alone.

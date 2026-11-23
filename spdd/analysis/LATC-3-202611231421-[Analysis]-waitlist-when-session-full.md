# SPDD Analysis: Waitlist When a Training Session Is Full (LATC-3)

> Source: Jira LATC-3 (Story, Backlog), fetched via the Atlassian MCP connector. Working copy: LATC-59 (In Progress).
> Analysed on branch `latc-3-waitlist-day4`, stacked on `latc-2-register-day4`. **LATC-2 is designed but not implemented yet**: the codebase still has no `Registration` model or registration endpoint. This analysis therefore builds on the planned LATC-2 design in `spdd/prompt/LATC-2-202611231415-[Feat]-api-register-for-training-session.md`, and must be re-checked once LATC-2 code exists.
> The untracked `openspec/` folder contains finished solutions from `main` and was deliberately not used.

## Original Business Requirement

_Migrated from WH-3_

### Context

After WH-2 is implemented, a session can fill up. When a session reaches capacity, subsequent employees who want to attend should be placed on a waitlist rather than being turned away. This ensures demand is captured and can be fulfilled if a registered employee cancels (WH-4 → WH-5).

This is a **trainee exercise story**. It is not implemented in the baseline template.

### Description

As an employee, I want to join a waitlist for a full training session so that I can attend if a place becomes available.

When a session is full, an employee can join the waitlist. The system records their position and informs them they are waitlisted, not confirmed.

### Acceptance Criteria

- When `registered >= capacity`, new registrations are added to the waitlist
- The waitlisted employee sees a message confirming they are waitlisted (not confirmed)
- The session card shows a "Join Waitlist" option when the session is full
- `POST /api/training-sessions/:id/registrations` returns HTTP 202 with `{ status: "waitlisted", position: N }` when full
- Waitlisted registrations have status `waitlisted` in the database
- Confirmed registrations have status `confirmed`

### Out of Scope

- Promotion from waitlist (WH-5)
- Cancellation (WH-4)
- Email notification (WH-8)
- Maximum waitlist size

### Suggested Tests

- `POST` when session is full → 202 with `status: "waitlisted"`
- `POST` when session has space → 201 with `status: "confirmed"`
- Waitlisted count is tracked separately from registered count
- Position in waitlist is correct (1st, 2nd, etc.)

### Data Model Hint

The `Registration` model should include a `status` field: `confirmed | waitlisted | cancelled`.

---

## Domain Concept Identification

### Existing Concepts (from codebase)

- **TrainingSession**: a workshop with a `capacity` and a stored `registered` counter. It is the only domain model in the codebase today.
- **Session card (UI)**: already computes `isFull` from `registered` and `capacity` and shows a "Full" badge. This is the natural place for the "Join Waitlist" option.

### Concepts From LATC-2 (planned, not yet in code)

- **Registration**: an employee's claim on a session (name and email), created by `POST /api/training-sessions/:id/registrations`. The LATC-2 design gives it **no status** and returns **409 when the session is full**. LATC-3 changes both.
- **Seat claim**: the atomic "increment only while `registered < capacity`" step inside the registration transaction. LATC-3 reuses its failure branch: "no seat" now means "waitlist" instead of "reject".
- **Register form on the card**: the name/email form and confirmation message. LATC-3 reuses it with a different label and message.

### New Concepts Required

- **Registration status**: the lifecycle `confirmed | waitlisted | cancelled`. LATC-3 uses only the first two. `cancelled` is declared for LATC-4.
- **Waitlist**: not a separate entity. It is the set of a session's registrations with status `waitlisted`, in the order they arrived.
- **Waitlist position**: a derived, 1-based rank of a waitlisted registration among the session's waitlisted registrations. It should not be stored, so it never needs renumbering when LATC-4/5 remove people from the list.
- **Waitlisted count**: how many people are waiting for a session. It is tracked separately from `registered` (suggested test) and shown on the card.

### Key Business Rules

- **Seat-or-wait**: if a seat can be claimed → `confirmed` (201) and `registered` +1. Otherwise → `waitlisted` (202) and `registered` unchanged. _(Registration, TrainingSession)_
- **Counter meaning narrows**: `registered` counts only `confirmed` registrations and never includes waitlisted ones. _(TrainingSession)_
- **Capacity invariant still holds**: `registered ≤ capacity`. Waitlisting never touches the counter. _(TrainingSession)_
- **Position is first-come-first-served**: ordered by arrival, contiguous (1, 2, 3 …), with no gaps or repeats, even under concurrent joins. _(Waitlist)_
- **Implicit: no full-session rejection any more**: the 409 "session full" from LATC-2 disappears. A full session always accepts a waitlist entry, and there is no maximum (out of scope).
- **Implicit: existing data**: registrations created before this change must count as `confirmed` (a default status).
- **Implicit: promotion order depends on this**: LATC-5 promotes the "first waitlisted", so the ordering rule chosen now becomes the promotion order.

---

## Strategic Approach

### Solution Direction

- **Extend, don't add**: keep the single `POST …/registrations` endpoint and the existing registration transaction. Add a status to `Registration` and branch on the seat-claim result: claimed → create a `confirmed` registration; not claimed → create a `waitlisted` one in the same transaction, then work out its position.
- Flow: route (validate) → service transaction [session exists → try to claim a seat → create a confirmed or waitlisted registration → compute position and counts] → route maps the outcome to 201 or 202.
- The response for both outcomes carries the registration's status, the position (waitlisted only), and the session's `registered`, `capacity` and waitlisted count, so the card updates without fetching again.
- UI: when the session is full, the card's register action turns into "Join Waitlist" instead of being disabled. After joining it shows a waitlisted message and the position, and the card shows how many people are on the waitlist.
- Tests: update the LATC-2 "full → 409" tests to "full → 202". Add tests for position ordering, a separate waitlisted count, the stored status, and a concurrency test where parallel requests split into exactly _capacity_ confirmed and the rest waitlisted with positions 1…N.

### Key Design Decisions

- **Status field vs separate Waitlist table**: a status field is simple, matches the ticket's data-model hint, and supports later transitions (promote, cancel) by updating one row. A separate table needs rows moved between tables on promotion. → **Status field on Registration.**
- **Stored vs derived position**: a stored position is cheap to read but has to be renumbered on every cancel or promotion (LATC-4/5) and is racy. A derived position (count of earlier waitlisted rows) is always correct. → **Derive the position.** Order by arrival using the auto-increment id, or `createdAt`. The id is safer because timestamps can tie under concurrency.
- **Waitlisted count: stored counter vs computed**: a second denormalised counter means more drift risk. Computing it on demand is cheap at this scale. → **Compute it**, and keep `registered` as the only stored counter.
- **Status representation**: SQLite through Prisma has no native enums. → A string field with a default of `confirmed`, plus a TypeScript union type and a constant set of allowed values in the service.
- **LATC-2 design must change**: the 409 "full" path and the button disabled when full (LATC-2 decision D6) are replaced. → Update the LATC-2 canvas/tests when implementing LATC-3, or implement LATC-2 and LATC-3 back-to-back on the stacked branches.

### Alternatives Considered

- **Separate `Waitlist` entity/table**: rejected because it complicates promotion (LATC-5) and duplicates the registration data.
- **Store `position` on the row**: rejected because it needs renumbering when people leave and is prone to races.
- **A separate `POST …/waitlist` endpoint**: rejected because the AC requires the same endpoint to return 202, and the client shouldn't need to know whether a seat is free before submitting.
- **Reject with 409 and let the client retry on the waitlist**: rejected because it is a race window and contradicts the AC.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **"Waitlisted count is tracked separately"**: does this mean exposed in the API or session payload, or only kept apart from `registered`? It probably needs to be visible on the card so the UI can show "N on waitlist". Decide whether the `GET /api/training-sessions` list includes it.
- **Response body for 202**: the AC gives `{ status, position }`. Should it also include the registration fields and session counts, like 201? Consistency with LATC-2 suggests yes.
- **Does 201 now include `status: "confirmed"`?** The suggested test implies yes. This is a small contract change to LATC-2's 201 body.
- **What the waitlisted message says**: wording isn't specified. It must clearly say "waitlisted, not confirmed".
- **Position visibility later**: should an employee be able to look up their position again after a reload? Not required here (and there is no auth). The analysis assumes it is shown only in the immediate response.

### Edge Cases

- **Concurrent joins when one seat is left**: exactly one confirmed. Positions for the rest must be contiguous with no duplicates.
- **Capacity 0 sessions**: every registration is waitlisted from the start. Probably fine, but untested.
- **A session that becomes "not full" while people are waiting**: this can't happen without cancellation (LATC-4) or a capacity change (no admin feature). Note for LATC-5: a new registrant must not jump ahead of the waitlist once seats free up.
- **The same email on the waitlist twice**: duplicate prevention is still out of scope, so allowed. Document it.
- **The 409 meaning frees up**: after LATC-3 nothing returns 409 for a full session. A later duplicate-prevention story may reuse 409.

### Technical Risks

- **Stacking on unimplemented LATC-2**: LATC-3 can't be built or tested until LATC-2's model and endpoint exist. Mitigation: implement LATC-2 first on `latc-2-register-day4`, then rebase this branch.
- **Schema change with existing rows**: adding a non-null status needs a default (`confirmed`), or `prisma db push` fails or loses data on dev DBs that already hold LATC-2 registrations.
- **Position under concurrency on SQLite**: computing the position inside the same transaction that inserted the row keeps it consistent. Writes are serialised by SQLite's lock, but "database is locked" timeouts remain a risk for concurrency tests. Keep the transaction timeout generous and the test small.
- **Counter drift**: the waitlist path must not touch `registered`. A regression would silently over-count confirmed seats. Assert this in the tests.
- **Shared dev/test DB**: same as LATC-2. Tests must create and clean up their own sessions.

### Acceptance Criteria Coverage

| AC# | Description                                                          | Addressable? | Gaps/Notes                                                                                   |
| --- | -------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| 1   | When `registered >= capacity`, new registrations go to the waitlist  | Yes          | Reuses the LATC-2 seat-claim failure branch. Depends on LATC-2 being implemented             |
| 2   | Waitlisted employee sees a "waitlisted (not confirmed)" message      | Yes          | Wording to be decided                                                                        |
| 3   | Card shows "Join Waitlist" when full                                 | Yes          | Replaces LATC-2's disabled button when full (D6)                                             |
| 4   | `POST` returns 202 `{ status: "waitlisted", position: N }` when full | Yes          | Replaces LATC-2's 409. Whether 202 also carries the registration and counts is to be decided |
| 5   | Waitlisted registrations stored with status `waitlisted`             | Yes          | New status field, with a default for existing rows                                           |
| 6   | Confirmed registrations stored with status `confirmed`               | Yes          | The 201 body should also expose `status`                                                     |

**Coverage: 6/6 addressable**, all of them conditional on LATC-2 being implemented first. Open questions/risks: 7 (exposing the waitlisted count, the 202 body shape, 201 gaining `status`, message wording, the LATC-2 dependency, the schema default for existing rows, position under concurrency).

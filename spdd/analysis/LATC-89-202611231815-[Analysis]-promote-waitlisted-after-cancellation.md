> **LATC-89** is a team copy of **LATC-5**. Its requirement matches LATC-71's, and the analysis below carries over `spdd/analysis/LATC-71-202611231712-[Analysis]-promote-waitlisted-after-cancellation.md` (from branch `latc-71-waitlist-promotion`).
>
> **What changed for this branch** (base `latc-88-cancel-registration`):
> - **D1 is settled differently.** Cancellation is no longer built here. LATC-88 already provides `DELETE …/registrations/:registrationId`, the conditional cancel transition, and a single `releaseSeat(tx, sessionId)` seam. LATC-89 replaces that seam with promote-or-release.
> - **D6 (AC2, "Confirmed after refresh")** is already delivered by LATC-88's `GET …/:registrationId` plus `localStorage`. The promoted employee's card reloads its status from the server, so no new client work is needed beyond showing "Confirmed".
> - The **mapping** LATC-2/3/4 → LATC-86/87/88 applies to every reference below.
> - **AC4 (notification)** stays deferred to LATC-8 with a marked hook point (D7).

# SPDD Analysis: Promote First Waitlisted Employee After Cancellation (LATC-71)

> Story card: **LATC-71** "Promote first waitlisted employee after cancellation — Alex Ngo" (team copy of **LATC-5**, linked).
> Branch: `latc-71-waitlist-promotion` (from `day4-training`). Kickoff notes: `stories/LATC-71.md`.

## Original Business Requirement

_Migrated from WH-5_ (copied from LATC-5 for Alex Ngo's kickoff)

### Context

When a confirmed registration is cancelled (WH-4), a seat becomes available. The first person on the waitlist should be automatically promoted to confirmed status. This closes the loop between cancellation and waitlist management.

This is a **trainee exercise story**. It is not implemented in the baseline template.

### Description

As a waitlisted employee, I want to be automatically promoted to confirmed when a registered employee cancels so that I can secure the now-available place.

Promotion is automatic — it fires as a side effect of cancellation (WH-4). No user directly triggers it. The first waitlisted employee (by `createdAt`) is promoted to `confirmed`.

### Acceptance Criteria

**What the user sees:**

- Promotion is invisible to the cancelling employee — they see only the standard cancellation success message
- A waitlisted employee who refreshes the sessions page after being promoted sees their status shown as "Confirmed" instead of "Waitlisted"
- The session card's registered/capacity count stays the same after promotion (the vacated seat is immediately filled)
- A notification is sent to the promoted employee (WH-8)

**API and backend behaviour:**

- When a confirmed registration is cancelled, the first waitlisted employee is automatically promoted to `confirmed`
- If there are no waitlisted employees, no promotion occurs and the `registered` count decrements by 1
- The session's `registered` count remains unchanged when promotion occurs (cancelled −1 and promoted +1 = net zero)
- Promotion is atomic: cancellation and promotion happen in the same database transaction
- The API response for cancellation includes `{ status: "cancelled", promotedRegistrationId: N }` if a promotion occurred, or `{ status: "cancelled", promotedRegistrationId: null }` if none

### Out of Scope

- Manual promotion by an organiser
- Promotion notification UI (covered in WH-8)

### Suggested Tests

- Cancel confirmed registration → first waitlisted employee is promoted
- Promoted employee status changes to "confirmed"
- No promotion when waitlist is empty — `registered` count decrements
- `registered` count unchanged when promotion occurs
- Cancellation and promotion are atomic (no partial state)

### Implementation Hint

Use a Prisma transaction to cancel and promote atomically.

---

## Domain Concept Identification

**Codebase state (grounded):** the branch is at the baseline. `api/prisma/schema.prisma` has only `TrainingSession` (`capacity`, `registered Int @default(0)`). The services are `trainingSessionService` (read-only `getAllSessions` and `getSessionById`). The routes are `training-sessions`, `health` and `admin`. There's no `Registration` model, no registration, waitlist or cancel code, and no `app/src/api.ts`. LATC-2 and LATC-3 exist **only as SPDD artefacts** (analysis and REASONS canvas). LATC-4 has no artefacts at all. Promotion is the fourth layer on a stack of which none is built yet.

### Existing Concepts (from codebase)

- **TrainingSession**: a bookable session with a fixed `capacity` and a denormalised `registered` counter. It's the aggregate whose seat count promotion must keep consistent.
- **Service-layer Prisma access via `lib/prisma`**: the only allowed path to the DB (AGENT.md). Promotion logic belongs in a service, not a route.

### Concepts Designed but Not Yet Built (prerequisites)

- **Registration** (LATC-2 canvas): one employee (name and email) holding a place on a session. It belongs to exactly one TrainingSession.
- **Registration status** (LATC-3 canvas, W5): `confirmed | waitlisted | cancelled`, stored as a string with the default `confirmed`. `cancelled` is declared but unused until LATC-4.
- **Waitlist** (LATC-3): not a table. It's the ordered set of a session's `waitlisted` registrations. Its order is **`Registration.id` ascending** (W3).
- **Atomic seat claim** (LATC-2): `registered` is only incremented through a conditional update in a transaction, so `registered ≤ capacity` holds under concurrency.
- **Cancellation** (LATC-4 card): `DELETE /api/training-sessions/:id/registrations/:registrationId` → 200 `{ status: "cancelled" }`, 404 when the registration is unknown, 409 when it's already cancelled. It decrements `registered` and _triggers promotion_.

### New Concepts Required

- **Promotion**: an automatic state change `waitlisted → confirmed` for the head of the session's waitlist, triggered only by a cancellation that frees a confirmed seat. It has no endpoint of its own.
- **Promotion outcome on the cancel response**: `promotedRegistrationId` (the promoted registration's id, or `null`). It's the only externally visible trace of promotion for the canceller.
- **Viewer's own registration status, readable after a refresh**: the "refresh and see Confirmed" AC needs a way for the waitlisted employee's browser to look up the _current_ status of their registration. Nothing in LATC-2 or LATC-3 provides this: card state is in memory only.

### Key Business Rules

- **Seat conservation**: `registered` always equals the count of `confirmed` registrations for the session, and `registered ≤ capacity`. A cancel with promotion is net zero. A cancel without promotion is −1. _(TrainingSession, Registration)_
- **FIFO fairness**: the promoted registration is the earliest-created `waitlisted` one in _that_ session. The order must match the `position` LATC-3 showed the user (W3 uses `id`, the card says `createdAt`, see ambiguities). _(Waitlist)_
- **Only a confirmed cancellation frees a seat**: cancelling a `waitlisted` registration removes it from the queue but never promotes anyone and never touches `registered`. _(implicit: Registration status, Cancellation)_
- **At most one promotion per cancellation**: one freed seat means one promotion. _(Promotion)_
- **All or nothing**: cancel, decrement and promote happen in one transaction. No observable state where the seat is freed but the promotion isn't done, or the reverse. _(explicit AC)_
- **Terminal cancellation**: a `cancelled` registration is never promoted and can't be cancelled again (409, from LATC-4). _(Registration status)_
- **Session scoping**: a registration can only be cancelled through its own session's URL. A mismatched `:id` / `:registrationId` pair is treated as not found. _(implicit, needed so promotion acts on the right waitlist)_

---

## Strategic Approach

### Solution Direction

- **Build the stack, then the delta.** LATC-71 can't be implemented on this branch until registration (LATC-2), waitlist (LATC-3) and cancellation (LATC-4) exist. The canvas for this story should treat LATC-2 and LATC-3 as prerequisites implemented from their existing canvases, and bring **LATC-4 cancellation in scope** together with promotion. LATC-4's own AC says "after cancellation, waitlist promotion is triggered", and building the two separately would mean writing a cancel transaction and then immediately rewriting it.
- **Data flow:** `DELETE` route (parse ids → map the result to a status code) → registration service _cancel-and-promote_ operation, inside a single DB transaction (load and validate the registration → mark it cancelled → if it was confirmed: find the waitlist head → promote it or decrement `registered`) → typed result union → route → JSON `{ status, promotedRegistrationId }`.
- **Follow the established patterns** from the LATC-2 and LATC-3 canvases: a result-union return from the service (no thrown domain errors), a `switch` in the route, the `REGISTRATION_STATUS` constant instead of raw strings, a per-route `try/catch` with a generic 500, and integration tests that clean up their own rows on the shared dev DB.
- **Frontend:** a "Cancel Registration" action with a confirmation prompt (LATC-4 ACs). The canceller sees only the standard success message, and the card's count is refreshed from the server rather than computed locally. That way, net zero after a promotion is shown correctly without special-casing.

### Key Design Decisions

- **D1 · Scope (cancel and promotion together vs. promotion only)**: promotion only would leave nothing to trigger it on this branch. Together means a bigger story, but one coherent transaction. → **Implement LATC-4 cancellation and LATC-71 promotion together.** Keep LATC-2 and LATC-3 as prerequisite canvases to generate first.
- **D2 · Where promotion lives (inline in the cancel transaction vs. a separate promote step or event)**: the AC requires the same transaction. An event or second call can't guarantee no partial state. → **Inline in the service's cancel operation, one interactive transaction.**
- **D3 · Seat accounting with promotion (decrement then increment vs. leave `registered` untouched)**: −1 and +1 briefly breaks nothing inside a transaction but adds writes and a window for bugs. Leaving the counter untouched expresses net zero directly. → **On promotion, don't change `registered`. Without promotion, decrement it with a guard (never below 0).**
- **D4 · Waitlist order key (`createdAt` vs. `id`)**: LATC-3 already showed users positions ordered by `id`. `createdAt` can tie at millisecond resolution in SQLite. The two agree in practice because ids are autoincrement. → **Order by `id` ascending, and write it down as equivalent to "by `createdAt`"**, so promotion picks exactly the user shown at position 1.
- **D5 · Concurrency on simultaneous cancellations (rely on the SQLite write lock vs. a conditional update on status)**: SQLite serialises write transactions, but a conditional update (`waitlisted → confirmed` only if still `waitlisted`, and `confirmed → cancelled` only if still `confirmed`) makes the logic correct on any DB. → **Use conditional state transitions and check the affected-row counts.** Two concurrent cancels must promote two _different_ people.
- **D6 · "See Confirmed after refresh" (new read endpoint vs. storing status on the client vs. defer)**: without auth, the browser only knows the registration id it received. Options: (a) remember the registration id on the client and add a read endpoint for one registration's current status, (b) list the session's registrations publicly (a privacy concern: it exposes names and emails), or (c) defer to a later story. → **(a), a minimal read of one registration by session id and registration id, with the id remembered client-side.** Needs confirmation (see ambiguities).
- **D7 · Notification AC (WH-8)**: the AC says a notification "is sent", but out-of-scope excludes only the notification _UI_, and LATC-8 owns notifications. → **No sending in this story. Leave a clear seam** (the promotion result carries the promoted registration) so LATC-8 can hook in. Needs confirmation.

### Alternatives Considered

- **Database trigger for promotion**: rejected. It hides business logic from the service layer, Prisma/SQLite `db push` doesn't manage triggers, and it can't be unit-tested.
- **Recompute `registered` from the count of `confirmed` rows instead of keeping a counter**: rejected for this story. It would change the LATC-2 contract (the atomic seat claim relies on the counter). Worth considering as a later refactor.
- **Promotion as its own endpoint (`POST …/promote`)**: rejected. The requirement says no user triggers it, and a second call breaks atomicity.
- **Stack this branch on an older promotion branch (`latc-4-cancel-registration`, which already merges a past `latc-5-waitlist-promotion`)**: the user rejected this at kickoff in favour of `day4-training`. Today's work is rebuilt from the SPDD artefacts.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **Prerequisite delivery**: are LATC-2 and LATC-3 to be generated on this branch first (from their canvases), or will a separate branch with them be merged in? The canvas needs to know whether its Operations start from the baseline or from LATC-3.
- **LATC-4 ownership**: is building cancellation here acceptable (D1), given that LATC-4 is a separate card in the training backlog?
- **"Refresh and see Confirmed"**: how does an unauthenticated browser identify "my" registration after a reload? Is a client-remembered registration id plus a single-registration read acceptable (D6), or should this AC be met only through the API (response or DB state)?
- **Notification AC vs. out of scope**: is "a notification is sent" a requirement for this story, or fully deferred to LATC-8 (D7)?
- **Ordering key**: the card says "by `createdAt`" and the LATC-3 canvas says position is by `id`. Confirm that `id` order is acceptable as the tie-free equivalent (D4).
- **Cancelling a waitlisted registration**: LATC-4 talks about cancelling a _confirmed_ registration. Is a waitlisted employee allowed to cancel (leave the queue)? If so, the response is presumably `promotedRegistrationId: null` with no counter change.
- **Status code for a session/registration id mismatch**: 404 (proposed) vs. 400.

### Edge Cases

- **Empty waitlist**: decrement only. `promotedRegistrationId: null`. _(explicit AC)_
- **Cancelling a waitlisted registration**: no seat is freed, so no promotion and no decrement, and the positions of everyone behind it shift up by one.
- **Already cancelled**: 409, no side effects, and no promotion on retry. This makes double-clicks safe.
- **Two concurrent cancellations in a full session with two or more waitlisted**: each must promote a distinct head. Neither may promote the same person twice.
- **A cancellation racing a new registration**: a new registrant must not grab the freed seat ahead of the waitlist head. The seat goes to the head inside the same transaction, so `registered` never drops below capacity at a point where a newcomer could see it.
- **A capacity change by an admin** (`routes/admin.ts`) that makes `registered > capacity`: does a cancellation then promote? The proposed rule is to promote only if, after the cancel, `registered − 1 < capacity`. Needs confirmation, or record it as out of scope.
- **Registration id from another session**: must not cancel it, and must not promote on the wrong session's waitlist.
- **A promoted employee's position display**: anyone still waitlisted sees their position drop by one on the next read. Positions are derived, so there's nothing to update.

### Technical Risks

- **No code exists yet**: the largest risk is sequencing. LATC-71's canvas will reference symbols (`Registration`, `REGISTRATION_STATUS`, `registrationService`, `api.ts`) that only exist once the LATC-2 and LATC-3 canvases are generated. Mitigation: make "LATC-2 and LATC-3 implemented and green" an explicit prerequisite gate in the canvas.
- **SQLite lock contention in concurrency tests**: interactive transactions with several writes can time out under parallel requests (the same issue LATC-2 noted). Mitigation: reuse the LATC-2 transaction timeout settings and keep concurrency tests small.
- **Counter drift**: any code path that changes `status` without adjusting `registered` (including admin tools) breaks seat conservation. Mitigation: all status changes go through the registration service. Add a test asserting `registered == count(confirmed)` after each scenario.
- **Shared dev DB in tests**: cancellation tests create sessions, registrations and waitlists. They must clean up, or other suites (session list counts) will flake.
- **Planted anti-patterns**: `routes/admin.ts` (its own `PrismaClient`) and `GET /search` (raw SQL) must not be copied into the new cancel route.

### Acceptance Criteria Coverage

| AC# | Description                                                                | Addressable? | Gaps/Notes                                                                                            |
| --- | -------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| 1   | Promotion is invisible to the canceller (standard success message only)    | Yes          | The frontend shows LATC-4's message and ignores `promotedRegistrationId` in the UI                    |
| 2   | A promoted employee who refreshes sees "Confirmed" instead of "Waitlisted" | Partial      | Needs a way to re-read one's own registration after a reload (D6). Not covered by any existing canvas |
| 3   | The card's registered/capacity count stays the same after promotion        | Yes          | Net zero in the service (D3). The UI refreshes counts from the server                                 |
| 4   | A notification is sent to the promoted employee (WH-8)                     | Partial      | Conflicts with LATC-8 ownership. Proposed: leave a seam only (D7)                                     |
| 5   | Cancelling a confirmed registration promotes the first waitlisted employee | Yes          | Requires LATC-2, LATC-3 and LATC-4 to be in place (D1). FIFO by `id` (D4)                             |
| 6   | No waitlist → no promotion, `registered` −1                                | Yes          | Guard against going below zero                                                                        |
| 7   | `registered` unchanged when a promotion happens                            | Yes          | D3                                                                                                    |
| 8   | Cancel and promotion in one DB transaction                                 | Yes          | D2, plus conditional transitions (D5)                                                                 |
| 9   | Response is `{ status: "cancelled", promotedRegistrationId: N \| null }`   | Yes          | This extends LATC-4's `{ status: "cancelled" }` body, so it's backward-compatible                     |

**Coverage: 7 of 9 fully addressable, 2 partial (AC2 and AC4) pending the decisions on D6 and D7.**

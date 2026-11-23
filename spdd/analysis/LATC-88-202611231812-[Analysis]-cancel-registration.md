# SPDD Analysis: Cancel Registration (LATC-88)

> Story card: **LATC-88** "Cancel registration — Alex Ngo" (team copy of **LATC-4**). Branch `latc-88-cancel-registration`, stacked on `latc-87-waitlist-when-full`. Story mapping in this loop: LATC-2 → LATC-86, LATC-3 → LATC-87, LATC-5 → LATC-89.

## Original Business Requirement

_Migrated from WH-4_ (copied from LATC-4 for Alex Ngo)

### Context

An employee may need to cancel their confirmed registration. This frees up a seat that can be offered to the first person on the waitlist (WH-5). Cancellation should update the `registered` count and trigger waitlist promotion.

This is a **trainee exercise story**. It is not implemented in the baseline template.

### Description

As a registered employee, I want to cancel my registration so that I can release my place for someone else.

The employee cancels using their registration ID. The system marks the registration as cancelled, decrements the registered count, and shows the updated state in the UI.

### Acceptance Criteria

**User interactions:**

- A "Cancel Registration" button is visible on the session card or registration confirmation page for an employee who has a confirmed registration
- Clicking "Cancel" shows a confirmation prompt: "Are you sure you want to cancel your registration for \[Session Title\]?"
- After confirming, the page shows a success message: "Your registration has been cancelled"
- The session card updates to reflect the new registered/capacity count (e.g., "11 / 20 registered (9 spots left)")
- If the employee has already cancelled, the Cancel button is not shown (or is disabled with label "Cancelled")

**API behaviour:**

- `DELETE /api/training-sessions/:id/registrations/:registrationId` returns HTTP 200 with `{ status: "cancelled" }`
- On cancellation, the registration status changes to `cancelled` in the database
- On cancellation, the session's `registered` count decrements by 1
- Returns HTTP 404 if the registration does not exist
- Returns HTTP 409 if the registration is already cancelled
- After cancellation, waitlist promotion (WH-5) is triggered

### Out of Scope

- Email confirmation of cancellation (WH-8)
- Cancellation by organiser
- Authentication — the registration ID serves as the identity token for training simplicity

### Suggested Tests

- `DELETE /api/.../registrations/1` → 200, status "cancelled"
- `DELETE /api/.../registrations/999` → 404
- `DELETE` already-cancelled registration → 409
- `registered` count decrements after cancellation
- Waitlist promotion triggered after cancellation

---

## Domain Concept Identification

**Codebase state (grounded):** on this branch (LATC-86 and LATC-87 implemented):

- `Registration` has `status` (`confirmed | waitlisted | cancelled`, string with default `confirmed`) and an index on `[sessionId, status]`.
- `registrationService.ts` exports `REGISTRATION_STATUS`, `RegistrationStatus`, `SessionCounts` (with `waitlisted`) and `registerForSession`, with internal helpers `details`, `waitlistPosition` and `sessionCounts`.
- `routes/registrations.ts` (`mergeParams`, `parseId`) has POST only.
- `app/src/api.ts` has `registerForSession`, and the card keeps register and waitlist state in memory.

`cancelled` is declared but never written.

### Existing Concepts (from codebase)

- **TrainingSession**: capacity plus a denormalised `registered` counter (confirmed seats).
- **Registration**: one employee's place, with a status (LATC-87).
- **Waitlist**: the ordered set of `waitlisted` rows. Position is derived by id (LATC-87).

### New Concepts Required

- **Cancellation**: the transition `confirmed → cancelled` (and, implicitly, `waitlisted → cancelled`), addressed by registration id within its session.
- **The browser's own registration**: there's no login, so the browser has to remember the registration id it received in order to show "Cancel Registration" or "Cancelled" for _its_ registration. That includes after a reload, otherwise the button disappears on refresh.

### Key Business Rules

- **Seat release:** cancelling a **confirmed** registration decrements `registered` by exactly 1, never below 0. Cancelling a **waitlisted** one changes no counter. _(TrainingSession, Registration)_
- **Terminal state:** `cancelled` can't be cancelled again (409). _(Registration)_
- **Session scoping:** a registration id is only valid under its own session's URL. A mismatch is "not found". _(implicit)_
- **Atomicity:** the status change and the counter change commit together. _(implicit, the same pattern as the LATC-86 seat claim)_
- **Promotion is a separate story:** the AC "after cancellation, waitlist promotion is triggered" is LATC-89's (WH-5) behaviour. This story leaves a clear seam where the freed seat would be handed on. _(boundary)_

---

## Strategic Approach

### Solution Direction

- `DELETE` route → service `cancelRegistration` (one transaction: find the row scoped by session → conditional status update → release the seat if it was confirmed) → result union → route `switch` → `200 { status: 'cancelled', session }`.
- A small read, `GET …/registrations/:registrationId` (status and position, no personal data), lets the card restore "my registration" after a reload from an id kept in `localStorage`.
- Reuse the LATC-86/87 conventions: result unions, exhaustive switches, `REGISTRATION_STATUS`, route `try/catch` with a generic 500, a 127.0.0.1-bound test server, and tests that clean up their own data.

### Key Design Decisions

- **D1 · Promotion now or later**: the AC mentions triggering promotion, but WH-5 / LATC-89 owns it. Building it here would duplicate LATC-89. → **Release the seat only. Put the seat-handoff point in the service (one place) so LATC-89 replaces the decrement with promote-or-decrement.**
- **D2 · Response body**: the AC needs `{ status: "cancelled" }`, and the UI needs fresh counts. → **Return `{ status: 'cancelled', session: SessionCounts }`.** It's additive, and the count isn't computed on the client.
- **D3 · Conditional transition**: `updateMany` where `status` is still the loaded status, and check the affected count. A concurrent double-cancel then yields exactly one 200 and one 409. → **Adopt.**
- **D4 · Cancelling a waitlisted registration**: the AC talks about confirmed registrations, but leaving the queue is natural. → **Allow it (200), with no counter change.**
- **D5 · Remembering my registration**: in-memory state loses the button on reload, and listing registrations publicly would expose names and emails. → **Keep `{registrationId}` per session in `localStorage`, plus a one-registration GET that returns no PII.**

### Alternatives Considered

- **Hard-delete the row**: rejected. Status history and LATC-89/90 rely on the `cancelled` rows existing.
- **Recompute `registered` from rows**: rejected. It would change the LATC-86 seat-claim contract.
- **Cancel through `PATCH status`**: rejected. The AC specifies `DELETE`.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- "Promotion is triggered" vs LATC-89's scope: resolved as a seam only (D1).
- Whether waitlisted employees can cancel: assumed yes (D4).
- Status for a session/registration mismatch: assumed 404.

### Edge Cases

- Double-click or two concurrent cancels: exactly one succeeds, and the other gets 409 (D3).
- `registered` already 0 because of data drift: the decrement is guarded, so it never goes negative.
- Stored id no longer exists (DB reset): the GET returns 404, so the client forgets the id.
- `localStorage` unavailable (private mode): every access is guarded, so the feature degrades to in-session only.

### Technical Risks

- Counter drift if any path changes status without adjusting `registered`. Mitigation: tests assert `registered === count(confirmed)` after each mutation.
- Shared-DB pollution from tests. Mitigation: tests create and delete their own sessions, and run against a scratch DB in this loop.

### Acceptance Criteria Coverage

| AC# | Description                                                 | Addressable? | Gaps/Notes                                   |
| --- | ----------------------------------------------------------- | ------------ | -------------------------------------------- |
| 1   | "Cancel Registration" visible for my confirmed registration | Yes          | D5 keeps it after a reload                   |
| 2   | Confirmation prompt text                                    | Yes          | `window.confirm` with the exact text         |
| 3   | "Your registration has been cancelled"                      | Yes          |                                              |
| 4   | Card count updates                                          | Yes          | From the response `session` (D2)             |
| 5   | Already cancelled → no button / "Cancelled"                 | Yes          | A disabled "Cancelled" label                 |
| 6   | DELETE → 200 `{ status: "cancelled" }`                      | Yes          | Plus `session` (D2)                          |
| 7   | Status becomes `cancelled`                                  | Yes          |                                              |
| 8   | `registered` decrements by 1                                | Yes          | Confirmed only                               |
| 9   | 404 when the registration doesn't exist                     | Yes          | Also when it belongs to another session      |
| 10  | 409 when already cancelled                                  | Yes          | D3                                           |
| 11  | Promotion triggered                                         | Partial      | A seam only. Behaviour comes in LATC-89 (D1) |

**Coverage: 10/11 fully, 1 partial (deferred to LATC-89 by design).**

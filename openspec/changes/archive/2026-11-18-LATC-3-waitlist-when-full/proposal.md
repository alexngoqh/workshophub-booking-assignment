# Proposal: LATC-3 Waitlist when a training session is full

## Why

Today a full session turns employees away with HTTP 409 (LATC-2), so demand is lost. Capturing a waitlist lets seats freed by cancellations (LATC-4) be offered to the next person (LATC-5).

## What Changes

- Registrations get a status: `confirmed`, `waitlisted` (and `cancelled`, used from LATC-4).
- **BREAKING (API)**: registering for a full session now returns HTTP 202 `{ status: "waitlisted", position: N }` instead of HTTP 409. Confirmed registrations return HTTP 201 with `status: "confirmed"`.
- Waitlisted registrations never change `registered`; the session listing exposes a separate `waitlisted` count.
- Duplicate prevention applies to any active registration (confirmed or waitlisted).
- UI: a full session's card shows "Join Waitlist" instead of a disabled button; joining shows a message that the employee is waitlisted (with position), not confirmed; the card shows how many are waiting.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `registrations`: full sessions waitlist instead of rejecting; responses carry status; UI offers Join Waitlist.
- `training-sessions`: session payload adds a `waitlisted` count.

## Impact

- Prisma: `status` column on `registrations` (default `confirmed`).
- API: registration service/route, session listing query.
- Frontend: card, registration form label, API types.
- Tests: LATC-2 "409 when full" and "Full disabled" tests are replaced by waitlist tests.

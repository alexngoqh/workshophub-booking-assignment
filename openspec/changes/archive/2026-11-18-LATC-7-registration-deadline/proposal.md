# Proposal: LATC-7 Registration deadline prevents late registration

## Why

Organisers need a cut-off to prepare for a session, but today employees can register (or join the waitlist) at any moment. A per-session deadline closes registration at a known time.

## What Changes

- `TrainingSession.registrationDeadline`: nullable date-time; returned in session payloads.
- `POST /api/training-sessions/:id/registrations` returns HTTP 422 `{ error: "Registration deadline has passed" }` when the server's current time is after the deadline. This applies to joining the waitlist as well. Sessions without a deadline are unaffected.
- Check order: invalid id 400 → unknown session 404 → invalid body 400 → deadline 422 → duplicate/seat logic.
- Cancelling is still allowed after the deadline (not restricted by the story).
- UI: future deadline → card shows "Registration closes: [formatted date]" near the button; passed deadline → card shows "Registration closed" instead of the Register / Join Waitlist button; if the server rejects a stale form with 422, the form shows "Registration for this session has closed". No label for sessions without a deadline.
- Seed: deadlines are set relative to seed time (one session open with a future deadline, one already closed, the rest without a deadline), because the seeded session dates are fixed.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `registrations`: registration is rejected after the deadline (API + UI).
- `training-sessions`: session payload includes `registrationDeadline`; card shows the deadline label.

## Impact

- Prisma schema (`db push`), seed data.
- API: registration service/route.
- Frontend: types, card/registration panel, form error mapping.

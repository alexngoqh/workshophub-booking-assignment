# Proposal: LATC-2 Employee can register for an available training session

## Why

Employees can browse sessions (LATC-1) but cannot sign up. Registration is the core transaction of WorkshopHub and the foundation for waitlist, cancellation, organiser view, deadline, notification and audit stories (LATC-3..9).

## What Changes

- New `Registration` record (session, name, email, created time) linked to a training session.
- `POST /api/training-sessions/:id/registrations` with `{ name, email }`: 201 on success, 400 invalid input, 404 unknown session, 409 when full.
- Duplicate registration prevention (same email, same session → 409). This is the "duplicate registration prevention" lab, which has no Jira ticket of its own; it is grouped here because it guards the same endpoint.
- Seat claiming is race-safe: concurrent requests can never push `registered` above `capacity`.
- Session card gets a Register button that opens a name/email form, shows a confirmation, updates the count in place, and is disabled when full.

## Capabilities

### New Capabilities
- `registrations`: employees registering for training sessions and the lifecycle of those registrations.

### Modified Capabilities
- None (the listing contract in `training-sessions` is unchanged; `registered` already exists).

## Impact

- Prisma schema: new `registrations` table (`db push`); seed clears registrations first.
- API: new nested router under `/api/training-sessions/:id/registrations`.
- Frontend: `TrainingSessionCard`, `TrainingSessionsPage`, new API client module.

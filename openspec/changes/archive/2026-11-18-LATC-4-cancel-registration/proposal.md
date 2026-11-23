# Proposal: LATC-4 Cancel registration

## Why

Employees who can no longer attend have no way to release their seat, so sessions stay artificially full and the waitlist (LATC-3) can never move. Cancellation frees the seat and is the trigger for promotion (LATC-5).

## What Changes

- `DELETE /api/training-sessions/:id/registrations/:registrationId` marks the registration `cancelled` and returns HTTP 200 `{ status: "cancelled" }` with updated session counts; 404 when the registration does not exist in that session; 409 when already cancelled.
- Cancelling a confirmed registration decrements `registered`; cancelling a waitlisted one leaves `registered` unchanged and removes the employee from the waitlist.
- `GET /api/training-sessions/:id/registrations/:registrationId` returns one registration's current status (and waitlist position), so the UI can show "my" status after a refresh.
- UI: the browser remembers the registrations made on it (registration id is the identity token, no auth). A card with my registration shows my status and a "Cancel Registration" button; it asks "Are you sure you want to cancel your registration for [Session Title]?", then shows "Your registration has been cancelled", updates the count, and shows a disabled "Cancelled" button. The employee may register again afterwards.
- Promotion of the next waitlisted employee is **not** part of this change (LATC-5).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `registrations`: adds cancellation, single-registration lookup, and the "my registration" UI.

## Impact

- API: registration service + routes. No schema change (`cancelled` status already exists).
- Frontend: card, API client, new local "my registrations" store.

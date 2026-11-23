# Proposal: LATC-9 Audit log for registration state changes

## Why

Organisers cannot reconstruct how a registration reached its current state (for example, waitlisted then promoted, or confirmed then cancelled), which they need for reporting and dispute resolution.

## What Changes

- New `AuditLog` table: `id`, `registrationId`, `fromStatus` (nullable), `toStatus`, `changedAt`, `reason` (optional).
- Every registration state change writes one audit entry **in the same transaction** as the change:
  - registration confirmed: `null → confirmed` (reason `registered`)
  - registration waitlisted: `null → waitlisted` (reason `waitlisted`)
  - promotion: `waitlisted → confirmed` (reason `promoted`)
  - cancellation: `confirmed|waitlisted → cancelled` (reason `cancelled`)
- `GET /api/training-sessions/:id/registrations/:registrationId/audit` returns the registration's history in chronological order; 404 when the registration does not exist for that session; 400 for invalid ids.
- Audit entries are immutable through the API: no create/update/delete endpoints exist for them.
- API only; no audit UI (out of scope per story). The organiser finds registration ids on the session detail page (LATC-6), which now shows each registration's id.

## Capabilities

### New Capabilities
- `registration-audit`: immutable history of registration status transitions and its query API.

### Modified Capabilities
- None (registration behaviour is unchanged; audit entries are a side effect).

## Impact

- Prisma schema (`db push`); seed clears audit rows.
- API: registration service writes entries in existing transactions; new route.
- Frontend: registration id column on the session detail page.

# LATC-9 — Audit log for registration state changes

- **Original card:** LATC-9 (status: Backlog, untouched)
- **Working copy:** LATC-129 Audit log for registration state changes — Alex Ngo (already In Progress, left as is)
- **Kicked off:** 2026-11-24 by Alex Ngo via /kickoff (deliver-story workflow)
- **Base:** `main`
- **Branch:** `latc-9-registration-audit-log` (existing branch, reused)

> **Gap-check run:** this story is already implemented on `main`. This run verifies the implementation against the acceptance criteria below and closes any gaps; it is not a fresh build.

## Acceptance criteria

**Organiser workflow:**

- [ ] Organiser identifies the registration ID from the session registrations page (WH-6)
- [ ] Organiser calls `GET /api/training-sessions/:id/registrations/:registrationId/audit` to see the full state history
- [ ] Response shows a time-ordered list of transitions (e.g. `null → confirmed`, `confirmed → cancelled`, `null → waitlisted` then `waitlisted → confirmed`)

**Data and API behaviour:**

- [ ] `AuditLog` table with `id`, `registrationId`, `fromStatus`, `toStatus`, `changedAt`, `reason` (optional)
- [ ] Every registration state change creates an audit entry atomically in the same transaction
- [ ] `GET .../audit` returns the full history in chronological order
- [ ] Audit entries are immutable (no update/delete via the API)
- [ ] Returns HTTP 404 if the registration does not exist
- [ ] Captures all transitions: initial registration, promotion, cancellation

## Out of scope

- User identity / actor tracking (no auth in this training)
- Audit log UI page (API only)
- Log rotation or archival

Requirements analysis: run `/spdd-analysis LATC-9` → `spdd/analysis/LATC-9-*`

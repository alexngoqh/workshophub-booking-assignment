# LATC-86 — Employee can register for an available training session — Alex Ngo

- **Story card:** LATC-86 (moved to In Progress)
- **Copied from:** LATC-2 (status: Backlog, untouched)
- **Kicked off:** 2026-11-23 by Alex Ngo via /kickoff (Day 4 loop, baseline rebuild)
- **Base:** `b4f8001` (Day 4 baseline + harness, before main was merged in)
- **Branch:** `latc-86-register-for-session`

## Acceptance criteria

- [ ] A register button or form is visible on each session card
- [ ] The employee provides name and email to register
- [ ] On success, `registered` increments by 1 and a confirmation message is shown
- [ ] If `registered >= capacity`, the register button is disabled or hidden
- [ ] `POST /api/training-sessions/:id/registrations` with `{ name, email }` returns 201 with registration details
- [ ] 400 when required fields are missing, 409 when the session is full, 404 when the session does not exist

## Out of scope

Duplicate prevention, waitlist (LATC-87), cancellation (LATC-88), email notification, authentication.

Requirements analysis: `spdd/analysis/LATC-86-*`

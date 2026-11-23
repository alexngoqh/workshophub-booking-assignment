# LATC-87 — Waitlist when a training session is full — Alex Ngo

- **Story card:** LATC-87 (moved to In Progress)
- **Copied from:** LATC-3 (status: Backlog, untouched)
- **Kicked off:** 2026-11-23 by Alex Ngo via /kickoff (Day 4 loop, baseline rebuild)
- **Base:** `latc-86-register-for-session` (stacked: needs LATC-86 registration)
- **Branch:** `latc-87-waitlist-when-full`

## Acceptance criteria

- [ ] When `registered >= capacity`, new registrations go on the waitlist
- [ ] The waitlisted employee sees they are waitlisted, not confirmed
- [ ] The session card shows "Join Waitlist" when the session is full
- [ ] `POST …/registrations` returns 202 with `{ status: "waitlisted", position: N }` when full
- [ ] Registrations have status `waitlisted` or `confirmed` in the database

## Out of scope

Promotion (LATC-89), cancellation (LATC-88), email notification, maximum waitlist size.

Requirements analysis: `spdd/analysis/LATC-87-*`

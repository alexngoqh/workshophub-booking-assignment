# LATC-90 — Organiser can view registrations for a session — Alex Ngo

- **Story card:** LATC-90 (moved to In Progress)
- **Copied from:** LATC-6 (status: Backlog, untouched)
- **Kicked off:** 2026-11-23 by Alex Ngo via /kickoff (Day 4 loop, baseline rebuild)
- **Base:** `latc-89-promote-waitlisted` (stacked: cancelled rows exist from LATC-88)
- **Branch:** `latc-90-organiser-view-registrations`

## Acceptance criteria

- [ ] Clicking a session card (title) opens `/sessions/:id`
- [ ] Detail page: session info + "Registrations" with Confirmed (N) and Waitlist (N)
- [ ] Entries show name, email, registration date; "No registrations yet" when both are empty
- [ ] Cancelled registrations hidden; no login needed
- [ ] `GET …/registrations` → 200 `{ confirmed, waitlisted }` with id, name, email, status, createdAt; 404 unknown session

Requirements analysis: `spdd/analysis/LATC-90-*`

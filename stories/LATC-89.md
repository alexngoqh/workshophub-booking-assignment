# LATC-89 — Promote first waitlisted employee after cancellation — Alex Ngo

- **Story card:** LATC-89 (moved to In Progress)
- **Copied from:** LATC-5 (status: Backlog, untouched)
- **Kicked off:** 2026-11-23 by Alex Ngo via /kickoff (Day 4 loop, baseline rebuild)
- **Base:** `latc-88-cancel-registration` (stacked: needs cancellation)
- **Branch:** `latc-89-promote-waitlisted`

## Acceptance criteria

- [ ] Promotion invisible to the canceller (standard message only)
- [ ] Promoted employee sees "Confirmed" after refresh
- [ ] Card count unchanged after promotion
- [ ] Notification to the promoted employee → deferred to LATC-8 (hook marked)
- [ ] Confirmed cancel promotes the first waitlisted; none waiting → `registered` −1; promotion → `registered` unchanged
- [ ] Cancel + promote in one transaction; response has `promotedRegistrationId` (id or null)

Requirements analysis: `spdd/analysis/LATC-89-*`

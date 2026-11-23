# LATC-88 — Cancel registration — Alex Ngo

- **Story card:** LATC-88 (moved to In Progress)
- **Copied from:** LATC-4 (status: Backlog, untouched)
- **Kicked off:** 2026-11-23 by Alex Ngo via /kickoff (Day 4 loop, baseline rebuild)
- **Base:** `latc-87-waitlist-when-full` (stacked: needs registration + waitlist status)
- **Branch:** `latc-88-cancel-registration`

## Acceptance criteria

- [ ] "Cancel Registration" visible for my confirmed registration, with the confirmation prompt
- [ ] "Your registration has been cancelled" and the card count updates
- [ ] Already cancelled → disabled "Cancelled"
- [ ] `DELETE …/registrations/:registrationId` → 200 `{ status: "cancelled" }`, status becomes `cancelled`, `registered` −1
- [ ] 404 unknown, 409 already cancelled
- [ ] Promotion triggered → deferred to LATC-89 (seam left in the service)

Requirements analysis: `spdd/analysis/LATC-88-*`

# LATC-71 — Promote first waitlisted employee after cancellation — Alex Ngo

- **Story card:** LATC-71 (status: In Progress)
- **Copied from:** LATC-5 (status: Backlog, untouched)
- **Kicked off:** 2026-11-23 by Alex Ngo via /kickoff
- **Base:** `day4-training` (LATC-3 waitlist and LATC-4 cancellation are prerequisites and not on `main` yet)
- **Branch:** `latc-71-waitlist-promotion`

## Acceptance criteria

**What the user sees**

- [ ] Promotion is invisible to the cancelling employee: they see only the standard cancellation success message
- [ ] A promoted employee who refreshes the sessions page sees "Confirmed" instead of "Waitlisted"
- [ ] The session card's registered/capacity count stays the same after promotion
- [ ] A notification is sent to the promoted employee (WH-8)

**API and backend**

- [ ] Cancelling a confirmed registration promotes the first waitlisted employee (by `createdAt`) to `confirmed`
- [ ] No waitlisted employees → no promotion, `registered` decrements by 1
- [ ] With a promotion, `registered` is unchanged (−1 + 1)
- [ ] Cancellation and promotion run in one database transaction
- [ ] The cancel response is `{ status: "cancelled", promotedRegistrationId: N | null }`

## Out of scope

- Manual promotion by an organiser
- Promotion notification UI (WH-8)

## Dependencies

- LATC-3 (waitlist: `Registration.status`, waitlist position) and LATC-4 (cancellation endpoint) must exist on this branch before promotion can be built. Neither is implemented on `day4-training` yet.

Requirements analysis: run `/spdd-analysis LATC-71` → `spdd/analysis/LATC-71-*`

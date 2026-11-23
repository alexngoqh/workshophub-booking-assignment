# Proposal: LATC-5 Promote first waitlisted employee after cancellation

## Why

After LATC-4 a cancelled seat simply becomes free, even when people are waiting. The waitlist (LATC-3) only has value if the freed seat goes to the next person automatically.

## What Changes

- When a **confirmed** registration is cancelled and the session has waitlisted registrations, the earliest waitlisted one is promoted to `confirmed` in the same transaction; `registered` stays the same (−1 +1).
- With an empty waitlist the behaviour is unchanged (`registered` −1).
- Cancelling a waitlisted registration never promotes anyone.
- The cancel response always includes `promotedRegistrationId` (the promoted id or `null`).
- Remaining waitlisted employees move up one position.
- UI: nothing new for the canceller (standard success message); the promoted employee sees "Confirmed" after refreshing (existing status lookup from LATC-4).
- Notification to the promoted employee is LATC-8.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `registrations`: cancellation of a confirmed registration now promotes the first waitlisted registration and reports it.

## Impact

- API: `cancelRegistration` service and DELETE response. No schema change.
- Frontend: no code change expected; covered by E2E with two browser contexts.

# Tasks

## 1. API

- [x] 1.1 Promote the earliest waitlisted registration inside `cancelRegistration` when a confirmed registration is cancelled; return `promotedRegistrationId`; verify Jest: promotion (status, id, registered unchanged, waitlisted −1, next position 1), empty waitlist decrements, cancelling a waitlisted row never promotes, concurrent cancels promote distinct registrations and never exceed capacity
- [x] 1.2 Update LATC-4 tests to assert `promotedRegistrationId: null` where applicable; verify Jest

## 2. Frontend

- [x] 2.1 Playwright with two browser contexts: waitlisted employee reloads and sees "Confirmed"; canceller sees only the standard message; registered count unchanged; second waitlisted moves to position 1; verify tests pass

## 3. Integration check

- [x] 3.1 Add `verify/latc-5.mjs`; run Jest, Playwright, lint, format-check, typecheck, build; verify all pass before committing `[LATC-5]`

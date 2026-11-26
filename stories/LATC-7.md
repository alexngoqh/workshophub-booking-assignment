# LATC-7 — Registration deadline prevents late registration

- **Original card:** LATC-7 (status: Backlog, untouched)
- **Working copy:** LATC-148 Registration deadline prevents late registration — Alex Ngo (already In Progress, left as is)
- **Kicked off:** 2026-11-26 by Alex Ngo via /kickoff
- **Base:** `main`
- **Branch:** `latc-148-registration-deadline`

Note: the story is already implemented on `main`; this run follows the SPDD flow against the existing implementation.

## Acceptance criteria

**User interactions:**

- [ ] When a session has a deadline in the future, the session card shows "Registration closes: [formatted date]" near the Register button
- [ ] When the deadline has passed, the session card shows "Registration closed" in place of the Register button
- [ ] The Register button is removed or disabled when the deadline has passed
- [ ] If a user submits the registration form after the deadline (e.g. page open before cutoff), they see an inline error: "Registration for this session has closed"
- [ ] Sessions without a deadline show no deadline label and allow registration at any time

**API behaviour:**

- [ ] `TrainingSession` has a `registrationDeadline` field (nullable `DateTime`)
- [ ] `POST /api/training-sessions/:id/registrations` returns HTTP 422 if the current time is after `registrationDeadline`
- [ ] The error body includes `{ error: "Registration deadline has passed" }`
- [ ] Sessions without a deadline allow registration at any time
- [ ] The deadline check uses server time (not client time)

## Out of scope

- Organiser UI for setting the deadline (seed data is sufficient)
- Automatic session status change at deadline
- Timezone handling beyond UTC

Requirements analysis: run `/spdd-analysis LATC-7` → `spdd/analysis/LATC-7-*`

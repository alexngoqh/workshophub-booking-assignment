# Tasks

## 1. API

- [x] 1.1 Service `listRegistrations` + `GET /api/training-sessions/:id/registrations` (confirmed/waitlisted arrays, cancelled excluded, ordered, 404, 400); verify Jest: mixed statuses, empty arrays, 404, fields present

## 2. Frontend

- [x] 2.1 Router (`usePath`, `navigate`) and `App` routes `/` and `/sessions/:id`; verify typecheck
- [x] 2.2 `SessionDetailPage`: details, back link, not-found state, Registrations section (Confirmed (N), Waitlist (N), entries with name/email/date, "No registrations yet"); verify via Playwright
- [x] 2.3 Card click + title link navigate; buttons/forms do not; verify via Playwright
- [x] 2.4 Playwright: card click opens detail and back returns; Register click does not navigate; detail shows confirmed + waitlist with entries and excludes cancelled; empty state; deep link; unknown id; verify tests pass

## 3. Integration check

- [x] 3.1 Add `verify/latc-6.mjs`; run Jest, Playwright, lint, format-check, typecheck, build; verify all pass before committing `[LATC-6]`

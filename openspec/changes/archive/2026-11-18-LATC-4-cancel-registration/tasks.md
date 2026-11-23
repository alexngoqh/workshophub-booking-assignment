# Tasks

## 1. API

- [x] 1.1 Service `cancelRegistration` (conditional update, decrement only for confirmed) and `getRegistration` (with position); verify via Jest
- [x] 1.2 Routes `DELETE` and `GET .../registrations/:registrationId` (200/404/409, 400 for bad ids); verify Jest: cancel confirmed (count -1, status stored), cancel waitlisted (registered same, waitlisted -1), 404 unknown, 404 other session, 409 twice (single decrement), re-register after cancel 201, GET lookup with position

## 2. Frontend

- [x] 2.1 `myRegistrations` localStorage store (safe on failure) and API client functions; verify typecheck
- [x] 2.2 Card shows my status + "Cancel Registration", confirm prompt, success message, count update, disabled "Cancelled"; status reloaded from API on mount; verify via Playwright
- [x] 2.3 Playwright: cancel confirmed (accept prompt, message, count, Cancelled), dismiss prompt keeps registration, status survives reload, cancel from waitlist; verify tests pass

## 3. Integration check

- [x] 3.1 Add `verify/latc-4.mjs`; run Jest, Playwright, lint, format-check, typecheck, build; verify all pass before committing `[LATC-4]`

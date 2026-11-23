# Tasks

## 1. Data model

- [x] 1.1 Add `Registration` model related to `TrainingSession`; seed clears registrations; verify `prisma db push` succeeds

## 2. API

- [x] 2.1 Implement registration service (validation, transaction, conditional seat claim, duplicate check); verify via integration tests
- [x] 2.2 Add `POST /api/training-sessions/:id/registrations` route mapping results to 201/400/404/409; verify Jest integration tests (success, count increment, 400 x2, 404, 409 full, 409 duplicate, concurrency) pass

## 3. Frontend

- [x] 3.1 Add API client for registration; Register button + name/email form on card; confirmation; in-place count update; disabled when full; verify via Playwright
- [x] 3.2 Playwright: register happy path, server error shown (duplicate), validation of empty form, full session disabled; verify tests pass

## 4. Integration check

- [x] 4.1 Run Jest, Playwright, lint and format-check; verify all pass before committing `[LATC-2]`

# Tasks

## 1. Data model

- [x] 1.1 Add `status` (default `confirmed`) to `Registration`; verify `prisma db push` succeeds and existing tests still pass

## 2. API

- [x] 2.1 Service: fall through to `waitlisted` when the seat claim fails, compute position, duplicate check on active registrations only; verify Jest tests (202 + position 1, positions 1..3, 201 includes status confirmed, duplicate while waitlisted -> 409, concurrency 3x201 + 5x202 with positions 1..5)
- [x] 2.2 Route returns 202 for waitlisted; verify Jest
- [x] 2.3 Session listing/detail include `waitlisted` count; update unit test expectation; verify Jest

## 3. Frontend

- [x] 3.1 Card shows "Join Waitlist" when full, waitlist message with position, "N on waitlist"; verify via Playwright
- [x] 3.2 Playwright: join waitlist on a full session (count unchanged, message, waitlist count), confirmed path still shows confirmation; replace the old "Full disabled" test; verify tests pass

## 4. Integration check

- [x] 4.1 Run Jest, Playwright, lint, format-check, typecheck and build; verify all pass before committing `[LATC-3]`

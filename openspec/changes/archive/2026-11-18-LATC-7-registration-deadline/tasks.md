# Tasks

## 1. Data

- [x] 1.1 Add nullable `registrationDeadline` to `TrainingSession`; relative deadlines in seed (one future, one passed); verify `prisma db push` + seed succeed and listing returns the field

## 2. API

- [x] 2.1 Deadline check (injectable clock) returning 422 `{ error: "Registration deadline has passed" }`; verify Jest: before → 201, after → 422 with no count change, full + after → 422 with no waitlist row, no deadline → 201, listing exposes `registrationDeadline`

## 3. Frontend

- [x] 3.1 Card: "Registration closes: [date]" for future deadline, "Registration closed" replacing the button when passed, nothing when no deadline; 422 mapped to "Registration for this session has closed"; verify via Playwright
- [x] 3.2 Playwright: seeded open session shows closes label, seeded closed session shows closed and no button, no-deadline session shows no label, deadline passes while form open → inline error and count unchanged; verify tests pass

## 4. Integration check

- [x] 4.1 Add `verify/latc-7.mjs`; run the full gate (Jest, Playwright, lint, format, typecheck, build); verify all pass before committing `[LATC-7]`

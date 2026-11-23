# Design

## Context

Behaviour is already implemented (see proposal.md - Why). The new piece is browser-level verification that every later LATC story will reuse. The API integration tests use a real SQLite file, and the dev environment uses ports 3001/5173.

## Goals / Non-Goals

**Goals:**
- One command (`pnpm --filter @workshophub/e2e test`) that boots everything it needs and runs browser tests.
- Tests never touch the developer's dev database or ports.
- Each test starts from identical seed data.

**Non-Goals:**
- Wiring E2E into CI or the pre-push hook (can follow later).
- Cross-browser coverage; Chromium only.

## Decisions

- **Separate workspace package `e2e/`** rather than adding Playwright to `app/`: E2E drives both API and app, so it belongs to neither. Alternative (Playwright inside `app/`) would couple frontend deps to backend boot scripts.
- **Playwright `webServer` boots API on 3101 and Vite on 5273** with `DATABASE_URL=file:../database/workshophub-e2e.sqlite`. The API command runs `prisma db push --force-reset` then seed, so every run starts from a clean schema. Alternative (reuse dev servers) was rejected: tests would mutate the developer's data.
- **Re-seed before each test** by running the existing seed script against the E2E database. Slower (~1s) than transactional rollback, but the API runs in a separate process so rollback is not available; correctness beats speed here. Requires `workers: 1`.
- **API errors simulated with `page.route`** for the error-state scenario instead of stopping the server.
- **Jest `--runInBand`**: integration suites share one SQLite file; parallel workers risk `SQLITE_BUSY`.

## Risks / Trade-offs

- [Re-seeding per test is slow as the suite grows] → acceptable for ~9 stories; revisit with a test-only reset endpoint if it exceeds a few minutes.
- [Port 3101/5273 already in use] → `strictPort` makes the failure explicit rather than silently hitting another server.

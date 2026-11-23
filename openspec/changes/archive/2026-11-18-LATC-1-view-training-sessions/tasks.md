# Tasks

## 1. E2E harness

- [x] 1.1 Add `e2e` workspace package with `@playwright/test`, register it in `pnpm-workspace.yaml`, ignore Playwright output dirs; verify `pnpm install` succeeds and `playwright install chromium` completes
- [x] 1.2 Add `playwright.config.ts` booting API (3101, isolated SQLite, force-reset + seed) and Vite (5273); verify `pnpm --filter @workshophub/e2e test` starts both servers
- [x] 1.3 Add `tests/helpers.ts` with `resetDatabase()` and API lookup helpers; verify a test can call it in `beforeEach`

## 2. LATC-1 verification

- [x] 2.1 Playwright: listing renders every seeded session as a card in date order; verify test passes
- [x] 2.2 Playwright: a card shows delivery badge, date, time, location and "N / M registered"; verify test passes
- [x] 2.3 Playwright: API failure shows the error state (via `page.route`); verify test passes
- [x] 2.4 Switch API Jest to `--runInBand` and verify `pnpm test` (all existing suites) passes

## 3. Integration check

- [x] 3.1 Run Jest, Playwright, lint and format-check together; verify all pass before committing `[LATC-1]`

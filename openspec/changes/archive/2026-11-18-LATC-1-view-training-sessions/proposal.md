# Proposal: LATC-1 View pre-seeded training sessions

## Why

LATC-1 is already implemented in the baseline template, but its behaviour is not captured anywhere as a contract and nothing verifies it in a real browser. Every later story (LATC-2 to LATC-9) builds on this listing, so it needs a written spec and an end-to-end safety net before we change it.

## What Changes

- Record the existing listing and session-lookup behaviour as the `training-sessions` capability spec.
- Add a Playwright end-to-end test package (`e2e/`) that boots the API and frontend on isolated ports against a dedicated SQLite file, re-seeding before each test.
- Add Playwright scenarios for LATC-1 (listing renders, card fields shown, date ordering, error state).
- Run the API Jest suite serially (`--runInBand`) because every integration test shares one SQLite file.
- No change to production behaviour.

## Capabilities

### New Capabilities
- `training-sessions`: browsing the catalogue of training sessions — listing, fetching one session, and the listing page in the web app.

### Modified Capabilities
- None.

## Impact

- New workspace package `e2e/` (dev dependency `@playwright/test`), `pnpm-workspace.yaml`, `.gitignore`.
- `api/package.json` test script.
- No API, schema or UI changes.

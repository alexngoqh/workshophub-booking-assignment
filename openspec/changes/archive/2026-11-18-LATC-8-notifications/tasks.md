# Tasks

## 1. Backend notifications

- [x] 1.1 `notifications` module: event type, `notify` (async, errors swallowed and logged), console transport, Slack transport when `SLACK_WEBHOOK_URL` is set, test hooks; verify Jest unit tests (console line content, Slack POST to a local HTTP server, transport failure is swallowed)
- [x] 1.2 Emit `confirmed` after a confirmed registration commits and `promoted` after a promotion commits; none for waitlisted; verify Jest integration tests (event payloads, no event for waitlist, failing transport still returns 201)
- [x] 1.3 Document `SLACK_WEBHOOK_URL` in `.env.example`; verify file content

## 2. Frontend banners

- [x] 2.1 Banner pub/sub + `Banner` component (dismiss button, 6 s auto-dismiss); registration panel shows the LATC-8 texts instead of inline confirmations; verify typecheck
- [x] 2.2 Update LATC-2/3 E2E assertions to the banners; new Playwright tests for confirmed banner text, waitlist banner text, dismiss, auto-dismiss (Playwright clock); verify tests pass

## 3. Integration check

- [x] 3.1 Add `verify/latc-8.mjs`; run the full gate; verify all pass before committing `[LATC-8]`

# Proposal: LATC-8 Send notification after registration or waitlist promotion

## Why

Employees get no clear feedback that their seat is secured, and a promoted employee only finds out by refreshing (LATC-5). A notification on confirmation and on promotion closes that gap.

## What Changes

- Backend notification module: after a **confirmed** registration and after a **waitlist promotion**, a notification event `{ name, email, sessionTitle, sessionDate, status: "confirmed" | "promoted" }` is emitted **after** the database transaction commits, fire-and-forget (the response never waits for it; failures are logged and swallowed).
- Baseline transport: structured log line on the server console. Optional: when `SLACK_WEBHOOK_URL` is set, the same event is posted to Slack as a message.
- Waitlisting and cancellation emit no backend notification (out of scope).
- UI: after a confirmed registration a banner shows "You're registered! [Session title] on [formatted date]"; after joining the waitlist it shows "You're on the waitlist for [Session title]. We'll let you know if a spot opens up." Banners appear without reload, can be dismissed, and auto-dismiss after a few seconds. These banners replace the inline confirmation messages from LATC-2/3; the card keeps showing "Your status: …" (including waitlist position).
- `.env.example` documents `SLACK_WEBHOOK_URL` (commented out).

## Capabilities

### New Capabilities
- `notifications`: server-side notification events and transports for registration outcomes.

### Modified Capabilities
- `registrations`: success feedback in the UI becomes the LATC-8 banners.

## Impact

- API: new `notifications` module; registration service emits events after commit.
- Frontend: banner component at app level; registration panel uses it.
- Tests: LATC-2/3 E2E assertions move from inline messages to banners.

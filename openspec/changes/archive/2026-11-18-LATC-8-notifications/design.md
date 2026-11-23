# Design

## Context

Registration and cancellation (with promotion) run inside Prisma interactive transactions in `registrationService`. Node 24 provides global `fetch`.

## Goals / Non-Goals

**Goals:** notify only after commit; never block or fail the request; testable transports.
**Non-Goals:** real email, SMS, notification history, cancellation notices.

## Decisions

- **Emit after the transaction resolves, not inside it**: a rolled-back transaction must never notify. The service calls `notify(event)` after `await prisma.$transaction(...)` returns a confirmed/promoted result.
- **Fire-and-forget via `queueMicrotask`/promise chain with `.catch`**: `notify` returns `void`, schedules delivery asynchronously, and logs any transport error. The request path never awaits it (story hint).
- **Pluggable transports**: a list of `(event) => Promise<void>`; default = console transport, plus Slack transport when `SLACK_WEBHOOK_URL` is set at send time. Tests replace transports via `setTransportsForTesting` and await `flushNotifications()` instead of sleeping.
- **Promotion details** come from the promote step, which now returns the promoted registration (name, email) rather than only its id.
- **UI banner**: app-level `Banner` fed by a tiny publish/subscribe module (`showBanner(text)`), so cards don't need prop drilling. Auto-dismiss after 6 s; `role="status"` for screen readers.

## Risks / Trade-offs

- [In-process fire-and-forget loses notifications if the server crashes right after responding] → acceptable for console/Slack in training; a queue would be the production answer.

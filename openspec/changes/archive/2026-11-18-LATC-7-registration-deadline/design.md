# Design

## Context

Registration logic lives in one interactive transaction (LATC-2/3). Seeded session dates are fixed in mid-2026, which is already in the past relative to the current date, so fixed deadlines in the seed would all be "closed".

## Goals / Non-Goals

**Goals:** server-authoritative cut-off; clear UI states; testable without waiting for real time to pass.
**Non-Goals:** organiser UI to set deadlines, automatic session status changes, timezone handling beyond UTC.

## Decisions

- **Nullable `DateTime` column**; `null` means open indefinitely.
- **Check inside the registration transaction** after the session lookup, using `new Date()` on the server. A clock is injected (`now` parameter defaulting to `new Date()`) so tests can be deterministic without mocking globals.
- **422 rather than 409/400**: the request is well-formed and conflict-free; it is semantically unprocessable at this time (as the story specifies).
- **UI decides "closed" from the client clock** only for display; the server remains the authority, and a 422 on submit is mapped to the friendly message. This covers a page left open past the cut-off.
- **Relative seed deadlines** (`now + 14 days` for one session, `now - 1 day` for another) so the demo always has one open and one closed session.
- **E2E time travel**: a small helper updates a session's deadline directly in the E2E database (via Prisma in the api package) so the "page opened before cut-off, submitted after" case is tested for real.

## Risks / Trade-offs

- [Client and server clocks differ] → UI may show "closes" a moment after the server closed; the 422 handling covers it.

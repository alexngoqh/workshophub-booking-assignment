# Design

## Context

All status changes already happen inside interactive transactions in `registrationService` (register, waitlist, cancel, promote).

## Goals / Non-Goals

**Goals:** atomic, complete, chronological history; no API to tamper with it.
**Non-Goals:** actor tracking (no auth), audit UI, retention/archival.

## Decisions

- **Write audit rows via a single helper `recordTransition(tx, registrationId, from, to, reason)`** called at each of the four transition points inside the existing transactions. Atomicity comes for free; there is exactly one place that defines the row shape.
- **`fromStatus`/`toStatus` as strings** matching registration statuses; `reason` is a short machine-friendly label (`registered`, `waitlisted`, `promoted`, `cancelled`).
- **Chronological order = `changedAt` then `id`**: two transitions in one transaction can share a millisecond (e.g. cancel A then promote B are different registrations, but ordering by id keeps any same-ms entries deterministic).
- **Foreign key with `onDelete: Cascade`** from AuditLog to Registration: the API never deletes registrations, so history is never lost through the API; cascade only matters for database-level cleanup (tests, reseeding). Alternative (no FK) would allow orphaned rows.
- **Immutability by construction**: only a GET route exists under `/audit`; Express returns 404 for other methods.

## Risks / Trade-offs

- [Direct DB access can still alter rows] → out of scope; the requirement is about the API.

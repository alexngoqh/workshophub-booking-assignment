# Design

## Context

`cancelRegistration` (LATC-4) runs in an interactive transaction and decrements `registered` only for confirmed rows. Positions are computed by id order (LATC-3).

## Goals / Non-Goals

**Goals:** cancel + promote atomically; no double promotion under concurrency.
**Non-Goals:** notifications (LATC-8), audit (LATC-9), manual promotion.

## Decisions

- **Promote inside the cancel transaction**: pick the lowest-id waitlisted row of the session and flip it with a conditional `updateMany ... where status='waitlisted'`. If that affects 0 rows (taken by a concurrent cancel), retry with the next candidate; if none remain, decrement instead. This keeps `registered` correct without relying on isolation level beyond SQLite's serialised writes.
- **"Earliest" = lowest id** to match the position rule from LATC-3 (ids are monotonic, no timestamp ties). Ticket says "by createdAt"; ids are assigned in creation order so the outcome is identical.
- **Return `promotedRegistrationId`** from the service so LATC-8 (notify) and LATC-9 (audit) can hook in at the same point.

## Risks / Trade-offs

- [Promoted employee is not told immediately] → covered by LATC-8; until then they see it on refresh.

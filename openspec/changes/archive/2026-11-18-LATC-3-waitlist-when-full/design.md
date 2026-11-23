# Design

## Context

LATC-2 stores a `registered` counter and claims seats with a conditional UPDATE. SQLite has no enums.

## Goals / Non-Goals

**Goals:** waitlist without weakening the over-booking guarantee; stable positions.
**Non-Goals:** promotion (LATC-5), max waitlist size.

## Decisions

- **`status` as a String column with default `confirmed`** (values `confirmed | waitlisted | cancelled`), validated in code; SQLite has no enum type. Existing rows become `confirmed`, which is correct.
- **Same transaction, fall-through**: the conditional seat claim stays; when it affects 0 rows the service inserts a `waitlisted` row instead of returning "full". So capacity is still enforced by the same single statement.
- **Position = number of waitlisted rows in the session with id ≤ mine**, computed in the transaction. Using the autoincrement id rather than `createdAt` avoids ties when two rows share a millisecond. Position is computed, not stored, so it stays correct after promotions (LATC-5).
- **`waitlisted` count on the listing** via Prisma filtered `_count`, flattened to a `waitlisted` number so the payload stays flat.

## Risks / Trade-offs

- [Clients relying on 409-when-full] → only our own UI uses it; updated in the same change.

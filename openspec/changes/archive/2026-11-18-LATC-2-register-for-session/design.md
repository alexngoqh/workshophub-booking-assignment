# Design

## Context

`TrainingSession.registered` already exists and is shown by the UI (see proposal.md - Why). SQLite via Prisma; no auth.

## Goals / Non-Goals

**Goals:** race-safe seat claiming; thin route, logic in a service.
**Non-Goals:** waitlist (LATC-3), cancellation (LATC-4), client-side persistence of "my registrations" (introduced with LATC-4).

## Decisions

- **Keep a stored `registered` counter** instead of computing it from registrations: the UI and listing already rely on it, and it lets the seat claim be one conditional statement. Alternative (COUNT on every read) adds a query per listing.
- **Seat claim = `UPDATE ... SET registered = registered + 1 WHERE id = ? AND registered < capacity`** inside an interactive Prisma transaction, then insert the registration. Zero affected rows means full. Alternative (read-check-write) races.
- **Duplicate check** inside the same transaction on `(sessionId, lower(trimmed email))`; emails are stored normalised. A unique index is not used because later stories allow re-registering after cancellation.
- **Service returns a discriminated result** (`confirmed | full | duplicate | session_not_found`); the route maps to HTTP codes.
- **UI**: inline form inside the card; the page owns session state and merges the returned counts.

## Risks / Trade-offs

- [Duplicate check without a DB constraint could race for the same email] → acceptable: SQLite serialises write transactions, so the check and insert cannot interleave.

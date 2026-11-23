# Design

## Context

No authentication; LATC-4 states the registration id is the identity token. Registration status values already exist (LATC-3).

## Goals / Non-Goals

**Goals:** atomic cancel + counter update; status visible after reload.
**Non-Goals:** promotion (LATC-5), notifications, organiser cancellation.

## Decisions

- **Conditional status update**: `UPDATE registrations SET status='cancelled' WHERE id=? AND sessionId=? AND status != 'cancelled'` inside a transaction; 0 rows → re-read to decide 404 vs 409. Two concurrent cancels of the same row therefore decrement at most once.
- **Decrement only when the cancelled row was `confirmed`**, using the status read inside the same transaction.
- **Remembering "my registrations" in `localStorage`** (`workshophub.myRegistrations`: sessionId → { registrationId }), wrapped in try/catch so private mode still works (status just isn't remembered). Alternative (cookie/server session) needs auth, which is out of scope.
- **Native `window.confirm`** for the prompt: accessible, matches the required wording, and Playwright handles it via the dialog event. A custom modal adds code without benefit for training.
- **Card fetches its own registration status** via the new GET endpoint when it has a stored id, so a reload or a later promotion (LATC-5) is reflected.

## Risks / Trade-offs

- [Anyone with a registration id can cancel it] → accepted by the story (no auth); ids are not exposed in the public listing.

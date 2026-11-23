# Proposal: LATC-6 Organiser can view registrations for a session

## Why

Organisers have no way to see who is attending or waiting for a session, so they cannot prepare delivery or contact participants. The data exists (LATC-2..5) but is not exposed.

## What Changes

- `GET /api/training-sessions/:id/registrations` returns `{ confirmed: [...], waitlisted: [...] }`, each entry `id, name, email, status, createdAt`; cancelled registrations excluded; 404 for an unknown session. Confirmed and waitlisted lists are in registration order (waitlist order = position order).
- New session detail page at `/sessions/:id`: full session info (title, date, time, location, delivery mode, full description) and a "Registrations" section with **Confirmed (N)** and **Waitlist (N)** subsections listing name, email and registration date; "No registrations yet" when both are empty. No login required.
- Clicking a session card (or its title link) on the listing opens the detail page; the detail page has a link back to all sessions. Buttons and form fields inside the card keep working without navigating.
- Client-side routing for `/` and `/sessions/:id` (browser back/forward supported, deep links work in dev and production).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `registrations`: adds the organiser registration list (API + page section).
- `training-sessions`: adds the session detail page and card navigation.

## Impact

- API: new list endpoint in the registrations router + service function.
- Frontend: `App` routing, new `SessionDetailPage`, card click/title link, API client.

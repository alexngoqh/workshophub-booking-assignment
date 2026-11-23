# Design

## Context

The app has a single page and no router dependency. Production serves `index.html` for unknown paths (`app.get('*')`) and Vite dev does the same, so deep links already reach the SPA.

## Goals / Non-Goals

**Goals:** two routes with back/forward support; organiser data via one request.
**Non-Goals:** auth/roles, pagination, export, editing from this view.

## Decisions

- **Tiny in-house router** (`usePath` hook on `popstate` + `navigate()` using `history.pushState`) instead of adding `react-router`: two routes don't justify a dependency, and it keeps the training template lean. Alternative considered: react-router-dom — better if routes grow; easy to swap later.
- **Card click** handled on the `<article>` with a guard that ignores clicks originating from `button, a, input, label, form`; the title is also a real `<a href="/sessions/:id">` so keyboard and middle-click work.
- **One API call** for the list returning both arrays (`confirmed`, `waitlisted`) ordered by id, matching waitlist positions.

## Risks / Trade-offs

- [Organiser list exposes emails without auth] → explicitly accepted by the story (no-auth training model).

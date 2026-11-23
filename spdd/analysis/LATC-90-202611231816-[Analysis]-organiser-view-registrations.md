# SPDD Analysis: Organiser Views Registrations for a Session (LATC-90)

> Story card: **LATC-90** "Organiser can view registrations for a session — Alex Ngo" (team copy of **LATC-6**). Branch `latc-90-organiser-view-registrations`, stacked on `latc-89-promote-waitlisted`. Mapping: LATC-2/3/4/5 → LATC-86/87/88/89.

## Original Business Requirement

_Migrated from WH-6_ (copied from LATC-6 for Alex Ngo)

### Context

Training organisers need visibility into who has registered for each session. They need to see confirmed registrations and the waitlist to prepare for delivery and communicate with participants.

This is a **trainee exercise story**. It is not implemented in the baseline template.

### Description

As a training organiser, I want to view the list of registrations for a session so that I can see who is attending and who is waitlisted.

### Acceptance Criteria

**User interactions:**

- Clicking on a session card navigates the user to a session detail page (e.g., `/sessions/:id`)
- The session detail page shows full session info (title, date, location, description) plus a "Registrations" section below
- The Registrations section has two subsections: **Confirmed (N)** and **Waitlist (N)**
- Each entry in both subsections shows: registrant name, email, and registration date
- When both sections are empty, the page shows "No registrations yet"
- Cancelled registrations are not shown
- The page is accessible to anyone without login (consistent with the no-auth training model)

**API behaviour:**

- `GET /api/training-sessions/:id/registrations` returns HTTP 200 with the full registration list
- The response includes separate arrays for `confirmed` and `waitlisted` registrations
- Each registration includes: `id`, `name`, `email`, `status`, `createdAt`
- Cancelled registrations are excluded from the response
- Returns HTTP 404 if the session does not exist

### Out of Scope

- Authentication or role-based access control
- Export to CSV or other formats
- Editing or cancelling registrations via this view
- Pagination

### Suggested Tests

- `GET /api/training-sessions/1/registrations` → 200 with confirmed and waitlisted arrays
- Cancelled registrations not included in response
- Returns 404 for unknown session
- Response includes name, email, status per registration

---

## Domain Concept Identification

**Codebase state (grounded):**

- **API:** `routes/registrations.ts` (mounted at `/api/training-sessions/:id/registrations`, `mergeParams`) has `POST /`, `DELETE /:registrationId` and `GET /:registrationId`. **`GET /` doesn't exist.** `registrationService` owns all registration queries. `GET /api/training-sessions/:id` already returns a single session.
- **App:** a single page (`App.tsx` renders `TrainingSessionsPage`). **No routing and no detail page.** Cards aren't clickable. `api.ts` has a private `request<T>` helper.

### Existing Concepts (from codebase)

- **TrainingSession**: session info (title, date, location, description, capacity, registered).
- **Registration**: name, email, status (`confirmed | waitlisted | cancelled`), createdAt (LATC-86/87/88).
- **Waitlist order**: by id ascending, the same order LATC-87 positions and LATC-89 promotion use.

### New Concepts Required

- **Registration roster**: the session's non-cancelled registrations, grouped into `confirmed` and `waitlisted`. It's a read model only, not stored.
- **Session detail page**: a second route, `/sessions/:id`, showing the session info and the roster.
- **Client-side navigation**: moving between the list and detail pages, including deep links and back/forward.

### Key Business Rules

- **Cancelled are invisible** in both the API and the UI. _(Registration status)_
- **Grouping by status:** confirmed and waitlisted are separate. Waitlist order equals queue order (id ascending) so the organiser sees the same order promotion will use. _(Waitlist)_
- **Unknown session → 404**, even though the roster would simply be empty. Existence is checked explicitly. _(TrainingSession)_
- **Open access:** no auth, as in the rest of the training model. Note that this endpoint exposes names and emails, which is accepted by the AC. _(implicit, flagged)_

---

## Strategic Approach

### Solution Direction

- **API:** `GET /` on the existing registrations router → service `listRegistrations(sessionId)` (session existence check + one query for non-cancelled rows ordered by id) → result union → `200 { confirmed: [], waitlisted: [] }` or 404.
- **App:** a tiny router with no library (`pushState` plus a custom event, `popstate`) with two routes, `/` and `/sessions/:id`. The card title becomes a link. A new `SessionDetailPage` fetches the session and the roster through `api.ts`.
- Reuse the conventions: result unions, exhaustive switch, route `try/catch` → 500, a 127.0.0.1 test server, tests that own their data.

### Key Design Decisions

- **D1 · Routing library vs hand-rolled**: React Router is a new dependency for two routes. → **Hand-rolled `router.ts`** (`navigate`, `usePath`, `Link`). No new dependencies. Deep links work through Vite's SPA fallback, and in production through Express's `app.get('*')`.
- **D2 · One query vs two**: one `findMany` with `status in [confirmed, waitlisted]` ordered by id, then split in memory. → **One query**, plus the existence check.
- **D3 · Fetch the session for the detail page**: reuse `GET /api/training-sessions/:id`. → **Two parallel client calls** (session + roster). No new combined endpoint.
- **D4 · Empty state**: "No registrations yet" only when **both** lists are empty. Otherwise show both subsections with their counts, including "(0)".
- **D5 · Navigation trigger**: the AC says "clicking on a session card". The card already contains the register form and buttons, so making the whole card clickable would hijack them. → **The title is a link** (an `<a href="/sessions/:id">`), and plain clicks are intercepted to use `navigate`.

### Alternatives Considered

- **Server-rendered detail page**: rejected, the app is a client-side SPA.
- **Include the roster in `GET /api/training-sessions/:id`**: rejected. It would change the LATC-1 contract and expose PII on the list page's endpoint.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- "Clicking on a session card" vs nested interactive controls: resolved as a title link (D5).
- Date format for "registration date": use the existing card date format (`en-SG` long date).
- Waitlist ordering in the UI isn't stated: use queue order (id ascending).

### Edge Cases

- Invalid id in the URL (`/sessions/abc`): the API returns 400, and the page shows an error state with a link back.
- Unknown session id: 404, so the page shows "Training session not found".
- A session with only cancelled registrations shows "No registrations yet".
- Back/forward browser buttons: `popstate` re-renders the right page.

### Technical Risks

- **PII exposure** (names, emails) on an unauthenticated endpoint: the AC requires it. Flag it for later stories, but don't block.
- **SPA deep links in production:** `app.ts` already serves `index.html` for unknown GETs, so `/sessions/:id` works after a build.
- **The route order** inside the registrations router: `GET /` and `GET /:registrationId` don't collide.

### Acceptance Criteria Coverage

| AC# | Description                                 | Addressable? | Gaps/Notes              |
| --- | ------------------------------------------- | ------------ | ----------------------- |
| 1   | Card click → `/sessions/:id`                | Yes          | The title link (D5)     |
| 2   | Detail page: info + "Registrations" section | Yes          |                         |
| 3   | Confirmed (N) / Waitlist (N) subsections    | Yes          |                         |
| 4   | Entries show name, email, date              | Yes          |                         |
| 5   | "No registrations yet" when both are empty  | Yes          | D4                      |
| 6   | Cancelled hidden                            | Yes          | Filtered in the service |
| 7   | No login                                    | Yes          |                         |
| 8   | GET → 200 full list                         | Yes          |                         |
| 9   | Separate `confirmed` / `waitlisted` arrays  | Yes          |                         |
| 10  | Fields id, name, email, status, createdAt   | Yes          |                         |
| 11  | Cancelled excluded from the API             | Yes          |                         |
| 12  | 404 for an unknown session                  | Yes          |                         |

**Coverage: 12/12.**

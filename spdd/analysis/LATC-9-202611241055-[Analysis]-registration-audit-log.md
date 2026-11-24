# SPDD Analysis: Audit Log for Registration State Changes

> Requirement source: Jira LATC-9 (working copy LATC-129), kickoff notes `stories/LATC-9.md`.
> **Gap-check finding:** the story is already fully implemented on `main` (schema, service, route, tests). This analysis verifies it against every AC; no code change is required.

## Original Business Requirement

# LATC-9 — Audit log for registration state changes

## Acceptance criteria

**Organiser workflow:**

- [ ] Organiser identifies the registration ID from the session registrations page (WH-6)
- [ ] Organiser calls `GET /api/training-sessions/:id/registrations/:registrationId/audit` to see the full state history
- [ ] Response shows a time-ordered list of transitions (e.g. `null → confirmed`, `confirmed → cancelled`, `null → waitlisted` then `waitlisted → confirmed`)

**Data and API behaviour:**

- [ ] `AuditLog` table with `id`, `registrationId`, `fromStatus`, `toStatus`, `changedAt`, `reason` (optional)
- [ ] Every registration state change creates an audit entry atomically in the same transaction
- [ ] `GET .../audit` returns the full history in chronological order
- [ ] Audit entries are immutable (no update/delete via the API)
- [ ] Returns HTTP 404 if the registration does not exist
- [ ] Captures all transitions: initial registration, promotion, cancellation

## Out of scope

- User identity / actor tracking (no auth in this training)
- Audit log UI page (API only)
- Log rotation or archival

## Domain Concept Identification

### Existing Concepts (from codebase)
- TrainingSession: the bookable session with capacity and `registered` counter — parent of Registration.
- Registration: a trainee's booking with status confirmed | waitlisted | cancelled — owns its audit history; created/changed only inside `registrationService` transactions.
- AuditLog (already present, `api/prisma/schema.prisma`, table `audit_logs`): immutable record of one status transition, with `id`, `registrationId`, nullable `fromStatus`, `toStatus`, `changedAt`, optional `reason`; cascades on registration delete.
- Transition recording (`recordTransition` in `registrationService.ts`): single helper writing an audit row with the caller's transaction client; used by register (null→confirmed, null→waitlisted), cancel (any→cancelled) and promotion (waitlisted→confirmed).
- Organiser registrations view (LATC-6/WH-6): `SessionDetailPage` lists registration IDs in a table, giving the organiser the ID needed for the audit call.

### New Concepts Required
- None. All concepts exist.

### Key Business Rules
- Atomicity: a state change and its audit entry commit or roll back together — governs Registration + AuditLog (enforced by writing inside the same `$transaction`; covered by `audit-atomicity.test.ts`, `promotion-atomicity.test.ts`).
- Immutability: audit entries are append-only; the API exposes only GET on `/audit` — governs AuditLog.
- Scoping: a registration is only found within its own session; a registration ID under a different session yields 404 — governs Registration/AuditLog lookup.
- Ordering: history is chronological, ties broken by id (same-transaction writes share a timestamp) — governs AuditLog read.
- Initial transitions have a null `fromStatus`.

## Strategic Approach

### Solution Direction
- Already realised following the reference layering: route (`routes/registrations.ts`) parses IDs and maps null→404 → service (`getAuditHistory`, `recordTransition`) owns all Prisma access → shared `lib/prisma.ts`. Data flow: state-changing service operation → in-transaction audit insert; read endpoint → service query ordered by `changedAt, id`.
- Remaining work for this run is verification only: run sensors and confirm tests pass.

### Key Design Decisions
- Write audit in the service transaction vs. Prisma middleware/DB trigger: explicit call is visible and testable → keep (current).
- `reason` as a coarse transition label (registered/waitlisted/promoted/cancelled) rather than free text: deterministic, no actor data (out of scope) → keep.
- Ordering tiebreak on id: avoids nondeterminism when promotion and cancellation share a timestamp → keep.

### Alternatives Considered
- Deriving history from Registration timestamps: loses intermediate transitions; rejected.
- Separate audit service module: unnecessary indirection at this size; rejected.

## Risk & Gap Analysis

### Requirement Ambiguities
- "Organiser identifies the registration ID from the session registrations page": page shows active registrations only; cancelled registrations' IDs are not listed there. Acceptable since the AC scopes to that page, but an organiser cannot discover cancelled IDs via the UI.
- Response shape (bare array vs wrapped object) is unspecified; implementation returns a bare array.

### Edge Cases
- Non-numeric IDs: returns 400 (tested).
- Registration exists under another session: 404 (tested).
- Re-cancel of a cancelled registration: no state change, so no audit entry (conditional update prevents it).
- Registrations created before the audit table existed (seed/legacy) would have empty history; seed data should be checked if present.

### Technical Risks
- Shared dev DB in tests: integration tests must clean up; any failure from stale data must not be "fixed" by reset in this workflow.
- SQLite timestamp granularity: mitigated by id tiebreak.

### Acceptance Criteria Coverage
| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Organiser finds registration ID on registrations page | Yes (implemented) | `SessionDetailPage` shows ID column; active registrations only |
| 2 | `GET .../audit` endpoint | Yes (implemented) | `routes/registrations.ts` |
| 3 | Time-ordered transitions in response | Yes (implemented) | ordered by changedAt, id; `audit.test.ts` |
| 4 | AuditLog table with required columns | Yes (implemented) | `schema.prisma` model AuditLog |
| 5 | Atomic audit entry per state change | Yes (implemented) | `audit-atomicity.test.ts`, `promotion-atomicity.test.ts` |
| 6 | Full history chronological | Yes (implemented) | same as AC3 |
| 7 | Immutable via API | Yes (implemented) | only GET route; test asserts PUT/PATCH/DELETE do not modify |
| 8 | 404 when registration missing | Yes (implemented) | tested incl. cross-session |
| 9 | Captures register, promotion, cancellation | Yes (implemented) | `recordTransition` at all four transition points |

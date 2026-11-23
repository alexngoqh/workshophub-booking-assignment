# Tasks

## 1. Data

- [x] 1.1 Add `AuditLog` model (FK to Registration, cascade) and index on registrationId; seed clears audit rows; verify `prisma db push` + seed

## 2. API

- [x] 2.1 `recordTransition` helper; write entries for registered, waitlisted, promoted, cancelled inside the existing transactions; verify Jest: each transition creates the right entry; rejected requests create none
- [x] 2.2 `GET .../registrations/:registrationId/audit` (chronological, 404, 400); PUT/PATCH/DELETE rejected; verify Jest: full lifecycle order, 404, 400, mutation attempts rejected and entries unchanged

## 3. Frontend

- [x] 3.1 Show registration id column on the session detail page; verify Playwright (id visible and its audit URL returns the history)

## 4. Integration check

- [x] 4.1 Add `verify/latc-9.mjs`; run the full gate; verify all pass before committing `[LATC-9]`

# LATC-150 — Admin route uses the service layer instead of its own PrismaClient — Alex Ngo

- **Original card:** LATC-150 (status: Backlog → In Progress)
- **Kicked off:** 2026-11-26 by Alex Ngo via /kickoff
- **Base:** `main`
- **Branch:** `latc-150-admin-route-service-layer`

## Acceptance criteria

- [ ] `api/src/routes/admin.ts` does not import `@prisma/client` or `lib/prisma`, and does not create a `PrismaClient`
- [ ] The query moves into a function in `api/src/services/` that uses the shared client from `lib/prisma.ts`
- [ ] The admin endpoint's HTTP behaviour does not change: same path, same status codes, same response body shape and ordering
- [ ] `api/src/routes/admin.ts` is removed from `scripts/no-prisma-in-routes.allow`, and `make sensors` is green
- [ ] Unit and integration tests prove the service function and the endpoint behaviour

## Out of scope

- The `GET /search` exemption in `routes/training-sessions.ts`
- Any new admin features, authentication, or changes to the response

Requirements analysis: run `/spdd-analysis LATC-150` → `spdd/analysis/LATC-150-*`

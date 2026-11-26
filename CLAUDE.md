# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read [AGENT.md](AGENT.md) first.** It holds the team's non-negotiable norms (no `any`, no Prisma in routes, definition of done). Those rules take precedence and are only summarised here.

## Project

WorkshopHub is an internal training-session registration system and the baseline template for an AI-assisted delivery training. It is a pnpm 9 workspace with three packages: `app/` (React 18 + Vite), `api/` (Express + Prisma on SQLite), and `e2e/` (Playwright). Stories are tracked in Jira project **LATC**. Commit messages are prefixed with the story key, e.g. `[LATC-5] ...`.

## Commands

The `Makefile` is the stable interface; prefer `make <target>` (`make help` lists them all).

```bash
make setup        # copy .env.example→.env, install, prisma generate, db push, seed
make dev          # app :5173 + api :3001
make test         # api unit + integration tests (Jest, --runInBand)
make test-unit    # unit only, no DB needed
make lint         # ESLint app + api
make format-check # Prettier
make reset-db     # force-reset + reseed dev DB
make smoke-test   # hit a running API (default :3001)
pnpm test:e2e     # Playwright
```

Run a single API test from `api/`:

```bash
pnpm exec jest tests/integration/cancellation.test.ts
pnpm exec jest -t "promotes first waitlisted"
```

**Test databases are isolated.**

- Jest uses `api/database/workshophub-test.sqlite`. `tests/globalSetup.ts` force-resets and reseeds it once per run, so tests never touch the dev DB.
- Integration tests create their own sessions via `createTestSession()` in `tests/integration/helpers.ts` and clean up afterwards. They don't depend on the seed data.
- E2E runs on its own ports (API 3101, app 5273) with its own SQLite file, started by Playwright's `webServer`. Set `SLOW_MO=<ms>` for a watchable headed run.

## Architecture

**API layering:** `routes/*` (parse and validate input, map results to HTTP status) → `services/*` (business rules and all Prisma access) → `lib/prisma.ts` (shared client). Use `routes/registrations.ts` → `services/registrationService.ts` as the reference. Two known exceptions are planted on purpose; don't copy them:

- `routes/admin.ts` creates its own `PrismaClient`.
- `GET /search` in `routes/training-sessions.ts` calls Prisma directly.

**Registration state machine** (`Registration.status`: `confirmed | waitlisted | cancelled`). This is the core of the domain and spans several stories:

- **Register:** if `registered < capacity` → `confirmed` (201) and `TrainingSession.registered` increments. Otherwise → `waitlisted` (202 with `position`). If `registrationDeadline` has passed (server time, UTC) → 422.
- **Cancel:** a confirmed registration → `cancelled`. In the **same transaction**, the oldest waitlisted registration (by `createdAt`) is promoted to `confirmed`, so the net change to `registered` is 0. With no waitlist, `registered` decrements. The response includes `promotedRegistrationId`.
- **Audit:** every status transition writes an immutable `AuditLog` row (`fromStatus → toStatus`) inside the same transaction as the change. Atomicity is enforced by `tests/integration/*-atomicity.test.ts` via `faultInjection.ts`.
- **Notifications** (`api/src/notifications`): fire-and-forget after commit, for confirmed registrations and promotions. They are never awaited on the request path, and a failure must not affect the response.

`registered` is a denormalised counter on `TrainingSession`. Keep it in sync inside the same transaction as any status change.

**Frontend:** `app/src/api.ts` is the HTTP client. There are two pages: the list (`/`) and session detail (`/sessions/:id`, showing the confirmed and waitlist sections). Shared types live in `app/src/types`.

**Specs:** OpenSpec lives in `openspec/`. `openspec/specs/` holds the current capability specs (training-sessions, registrations, registration-audit, notifications); proposals go in `openspec/changes/`. Check the relevant spec before changing behaviour.

## Harness

Package guides: [api/CLAUDE.md](api/CLAUDE.md) and [app/CLAUDE.md](app/CLAUDE.md). What the agent may do alone is defined in AGENT.md §4 AGENT_BOUNDARY.

Story flow: `/kickoff LATC-N` → `/spdd-analysis` → `/spdd-reasons-canvas` → `/spdd-generate` → `/sensor-and-fix` → `/finish-dev`.

| Piece                                                     | What it does                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `scripts/reasons-lint.sh` (`make reasons-lint`)           | SPDD prompts in `spdd/prompt/` have all 7 REASONS sections, in order and non-empty. Passes when there are none yet |
| `scripts/branch-name-check.sh` (`make branch-name-check`) | branch is `latc-<N>-<slug>`; `main` is exempt, others via `BRANCH_NAME_EXEMPT`                                     |
| `scripts/no-prisma-in-routes.sh`, `safeguards-quality.sh`, `agent-boundary-check.sh`, `apm-audit.sh` | api layering; concrete canvas Safeguards with untrusted-context; AGENT_BOUNDARY present; `.apm/` drift. All in `make sensors`, pre-push and CI |
| `.apm/` + `apm install` | **Source of truth** for commands (`prompts/`), skills and hooks; deploys to `.claude/` and `.opencode/`. Edit `.apm/`, never the deployed copy. Exceptions (platform-specific): `scripts/apm-audit.allow` |
| `make eval` | promptfoo evals in `labs/`, run on Claude via the local `claude` CLI (`lib/claudeCliProvider.js`) |
| `.husky/pre-commit`                                       | branch-name check + reasons-lint on staged prompts                                                                 |
| `.husky/pre-push`                                         | both sensors + format-check, lint, test (+ Gitleaks/Trivy if installed)                                            |
| CI `pr-check` / `mr-check`                                | reasons-lint as a merge gate, then test, lint, format                                                              |
| `.claude/hooks/prettier-on-write.sh`                      | PostToolUse: Prettier on every Write/Edit                                                                          |
| `.claude/hooks/block-push-to-main.sh`                     | PreToolUse: blocks direct pushes to the default branch                                                             |
| `/kickoff`, `/sensor-and-fix`, `/finish-dev`              | start a story; run the sensors and fix failures; commit → push → MR → Slack → Jira In Review                       |
| skills `commit`, `mr`                                     | `[LATC-N]` commit; push + MR/PR + Slack notification                                                               |

## Gotchas

- Schema changes are applied with `prisma db push` (no migration files). The Docker entrypoint runs it on every container start.
- `docs/trainer-only/` is trainer material. Don't read it for implementation hints or modify it.
- The pre-push hook runs both sensors, test, lint, format-check, and Gitleaks/Trivy when installed. CI (`pr-check` / `mr-check`) runs reasons-lint, test, lint, and format-check.

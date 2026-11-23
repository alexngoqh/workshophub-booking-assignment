# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read [AGENT.md](AGENT.md) first.** It holds the team's non-negotiable norms (no `any`, no Prisma in routes, definition of done). Those rules take precedence and are only summarised here.

## Project

WorkshopHub is an internal training-session registration system and the baseline template for an AI-assisted delivery training. It is a pnpm 9 workspace with two packages: `app/` (React 18 + Vite) and `api/` (Express + Prisma on SQLite). Stories are tracked in Jira project **LATC**. Commit messages are prefixed with the story key, e.g. `[LATC-5] ...`.

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
```

Run a single API test from `api/`:

```bash
pnpm exec jest tests/integration/training-sessions.test.ts
pnpm exec jest -t "returns 200 with an array of sessions"
```

**Tests share the dev database.** `tests/setup.ts` points Jest at `api/database/workshophub.sqlite`, the same file `make dev` uses. Integration tests that write data must clean up after themselves, and `make reset-db` restores the seed. There is no E2E package in the baseline.

## Architecture

**API layering:** `routes/*` (parse and validate input, map results to HTTP status) → `services/*` (business rules and all Prisma access) → `lib/prisma.ts` (shared client). Use `routes/training-sessions.ts` → `services/trainingSessionService.ts` as the reference. Two known exceptions are planted on purpose; don't copy them:

- `routes/admin.ts` creates its own `PrismaClient`.
- `GET /search` in `routes/training-sessions.ts` calls Prisma directly.

**Domain (baseline):** only `TrainingSession` exists (LATC-1: browse sessions). It has a `capacity` and a `registered` counter. Registration and everything after it (LATC-2 onwards) are trainee exercises and are not implemented yet. Read the Jira story before building one.

**Package guides:** [api/CLAUDE.md](api/CLAUDE.md) and [app/CLAUDE.md](app/CLAUDE.md) hold the package-specific rules.

**Frontend:** `app/src/api.ts` is the intended HTTP client. It doesn't exist in the baseline yet (the list page still calls `fetch` inline), and the first story that needs a new call creates it. The list page shows a `TrainingSessionCard` per session. Shared types live in `app/src/types`.

## Harness

Story flow: `/kickoff LATC-N` → `/spdd-analysis` → `/spdd-reasons-canvas` → `/spdd-generate` → `/sensor-and-fix` → `/finish-dev`. What the agent may do alone is defined in AGENT.md §4 AGENT_BOUNDARY.

| Piece                                                     | What it does                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `scripts/reasons-lint.sh` (`make reasons-lint`)           | SPDD prompts have all 7 REASONS sections, in order and non-empty               |
| `scripts/branch-name-check.sh` (`make branch-name-check`) | branch is `latc-<N>-<slug>`; `main` is exempt, others via `BRANCH_NAME_EXEMPT` |
| `.husky/pre-commit`                                       | branch-name check + reasons-lint on staged prompts                             |
| `.husky/pre-push`                                         | both sensors + format-check, lint, test (+ Gitleaks/Trivy if installed)        |
| CI `mr-check` / `pr-check`                                | reasons-lint as a merge gate, then test, lint, format                          |
| `.claude/hooks/prettier-on-write.sh`                      | PostToolUse: Prettier on every Write/Edit                                      |
| `.claude/hooks/block-push-to-main.sh`                     | PreToolUse: blocks `git push … main`                                           |
| skills `commit`, `mr`                                     | `[LATC-N]` commit; push + MR/PR + Slack notification                           |

## Gotchas

- Schema changes are applied with `prisma db push` (no migration files). The Docker entrypoint runs it on every container start.
- `docs/trainer-only/` is trainer material. Don't read it for implementation hints or modify it.
- The pre-push hook runs both sensors, test, lint, format-check, and Gitleaks/Trivy when installed. CI (`pr-check` / `mr-check`) runs reasons-lint, test, lint, and format-check.

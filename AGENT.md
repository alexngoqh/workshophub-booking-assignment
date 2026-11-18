# AGENT.md

Operating instructions for AI coding agents working in the WorkshopHub repository.
Read this before making any change. It defines project context, the team's hard
norms, and the boundaries within which an agent is allowed to act.

---

## 1. Project Context

**What it is.** WorkshopHub is an internal training registration system: employees
browse internal training sessions and register for them. This repository is the
baseline codebase template for the 3-day AI-assisted software delivery training.

**Monorepo.** A pnpm 9 workspace with three packages:

| Package              | Path   | Stack                                             |
| -------------------- | ------ | ------------------------------------------------- |
| `@workshophub/app`   | `app/` | React 18 + TypeScript + Vite 5 (frontend)         |
| `@workshophub/api`   | `api/` | Node 24 + TypeScript + Express + Prisma (API)     |
| `@workshophub/e2e`   | `e2e/` | Playwright (end-to-end tests)                     |

**Tech stack.** SQLite via Prisma ORM; Jest + Supertest for API tests;
ESLint + Prettier; Husky pre-push hooks; GitHub Actions CI; Docker / Docker
Compose. `pnpm` is the package manager and the `Makefile` is the stable command
interface — prefer `make <target>` over raw `pnpm` / `docker` invocations.

**Ports.** Dev: frontend `5173`, API `3001`. Prod (Docker): `8080`. Dev and prod
run on separate ports, so both can be up locally at the same time.

### Repository layout

```
app/                  React + TypeScript + Vite frontend
  src/                components/, pages/, types/, api.ts
api/                  Express API
  src/
    app.ts            Express app + router wiring
    server.ts         Entrypoint
    routes/           HTTP handlers — input parsing + delegation only
    services/         Business logic + all database access
    lib/prisma.ts     Shared PrismaClient instance
    notifications/    Post-transaction notifications
  prisma/             schema.prisma + seed.ts
  tests/              unit/ + integration/
database/             SQLite file (created at runtime, gitignored)
docs/                 Story + reference material
Makefile              Stable command interface
```

### Common commands

Use the Makefile. `make help` lists everything.

| Command                 | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `make setup`            | Install deps, generate client, push schema, seed |
| `make dev`              | Run frontend + backend together                |
| `make test`             | Run unit + integration tests                   |
| `make test-unit`        | Unit tests only (no database required)         |
| `make lint`             | ESLint across all packages                     |
| `make format-check`     | Prettier check across all packages             |
| `make build`            | Build frontend + backend                       |
| `make seed` / `make reset-db` | Seed / force-reset and re-seed the DB    |
| `make smoke-test`       | Validate a running app (default port 3001)      |

---

## 2. Team Norms

These are non-negotiable. An agent must follow them on every change, in every
package.

### No `any`

Never use the `any` type. Prefer an explicit type, a real interface, or `unknown`
with a narrowed guard. The rule is enabled in both packages via
`@typescript-eslint/no-explicit-any` (`error` in `app/.eslintrc.cjs` through the
recommended preset, `warn` in `api/.eslintrc.cjs` as an explicit override).
Treat it as an error everywhere. Narrow, targeted casts (`as SomeType`) are
acceptable only at genuinely untyped boundaries — e.g. a Prisma row being shaped
into a DTO — and must stay as narrow as possible.

### No direct Prisma in routes

HTTP routes (`api/src/routes/*`) must not import or call Prisma. The layering is:

```
routes   →   services   →   lib/prisma
(handler)  (logic + DB)   (PrismaClient)
```

Routes only parse and validate input, then delegate to a service; services own
all database access and business rules. `registrations.ts` →
`registrationService.ts` is the reference pattern (a route imports only from
`../services`, never from `../lib/prisma`).

> Note: the `GET /search` route in `training-sessions.ts` currently calls Prisma
> directly. That is a known exception / planted issue, **not** a pattern to copy.
> Do not spread it to new routes.

### All code must pass `make test` and `make lint`

No change is considered complete unless it passes:

- `make test` — unit + integration tests green
- `make lint` — ESLint clean across `app` and `api`

The pre-push hook additionally runs `format-check` and a security scan, and CI
(`pr-check`) runs test + lint + format-check. Run these locally before pushing;
do not leave a change that fails any of them.

### Definition of done

- [ ] Code passes `make test` and `make lint`
- [ ] `make format-check` is clean (Prettier)
- [ ] No new `any`
- [ ] No new direct Prisma imports in routes
- [ ] New behaviour is covered by a test in `api/tests/`
- [ ] No secrets, `.env`, or generated artifacts (`dist/`, `database/`) committed

---

## 3. MCP Permissions

<!-- PLACEHOLDER: not yet defined. Fill in the per-server / per-tool permission
     policy that governs which MCP tools an agent may invoke and with what scope. -->

> **Placeholder — pending definition.**
>
> Servers configured for this repo: `jira` (Atlassian) and `github` (GitHub
> Copilot), see `.mcp.json` / `opencode.json`. Decide and record the policy
> here — for each server/tool: read-only vs. read-write, whether the agent may
> invoke it autonomously, and which actions require human approval first.

---

## 4. AGENT_BOUNDARY

<!-- PLACEHOLDER: not yet defined. Fill in the agent's scope of authority. -->

> **Placeholder — pending definition.**
>
> Record here what the agent is and is not permitted to do: which files /
> directories it may modify; which commands it may run autonomously vs. which
> require approval (e.g. destructive `make reset-db`, pushing to `main`,
> touching `docs/trainer-only/`); and the review / approval workflow that
> governs its changes.

---

_Keep this file current. If a norm here conflicts with a tool's default
behaviour, the norm wins._

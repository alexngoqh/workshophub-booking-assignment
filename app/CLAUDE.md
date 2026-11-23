# app/CLAUDE.md

Scoped guidance for the React 18 + Vite frontend. The root [CLAUDE.md](../CLAUDE.md) and [AGENT.md](../AGENT.md) still apply; AGENT.md wins on any conflict.

## Layout

```
src/main.tsx                         entry
src/App.tsx                          shell
src/pages/TrainingSessionsPage.tsx   list page (fetches sessions)
src/components/TrainingSessionCard.tsx  one card per session (+ .css)
src/types/index.ts                   shared types, mirroring the API response shapes
```

The dev server runs on :5173 and proxies `/api` and `/health` to :3001 (`vite.config.ts`, overridable with `VITE_API_URL`).

## Rules for this package

- **HTTP goes through `src/api.ts`.** That file doesn't exist yet: the baseline still calls `fetch` inline in `TrainingSessionsPage.tsx`. The first story that needs a new call (LATC-2) creates `src/api.ts` and moves the existing fetch into it. Components never call `fetch` directly.
- **Types live in `src/types/index.ts`** and match the API JSON exactly. No `any`, and no inline duplicate interfaces.
- **Disable, don't hide, unavailable actions.** For example, show the register button as disabled when `registered >= capacity`, unless the story says otherwise.
- Show API error messages to the user: 400 / 404 / 409 each get a readable message, not a silent failure.
- Plain CSS files next to their component. No new UI or CSS libraries without a story asking for one.

## Checks

```bash
pnpm --filter @workshophub/app lint
pnpm --filter @workshophub/app format-check
pnpm --filter @workshophub/app build   # tsc + vite build (type check)
```

There are no frontend unit tests or E2E in the baseline. For UI changes, run `make dev` and check the page by hand, or use `/run`.

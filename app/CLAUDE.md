# app/CLAUDE.md

Scoped guidance for the React 18 + Vite frontend. The root [CLAUDE.md](../CLAUDE.md) and [AGENT.md](../AGENT.md) still apply; AGENT.md wins on any conflict.

## Layout

```
src/main.tsx, App.tsx                entry and shell
src/router.ts                        minimal client router: "/" and "/sessions/:id" (navigate, usePath)
src/pages/TrainingSessionsPage.tsx   list page
src/pages/SessionDetailPage.tsx      detail page: session info + Confirmed / Waitlist sections
src/components/TrainingSessionCard.tsx, RegistrationPanel.tsx, RegistrationForm.tsx, Banner.tsx
src/api.ts                           the only HTTP client; returns ApiResult<T>
src/myRegistrations.ts               this browser's registration ids per session (localStorage)
src/format.ts, banner.ts             formatting and banner helpers
src/types/index.ts                   shared types
```

The dev server runs on :5173 and proxies `/api` and `/health` to :3001 (`vite.config.ts`, overridable with `VITE_API_URL`).

## Rules for this package

- **All HTTP goes through `src/api.ts`.** Components never call `fetch`. Handle `ApiResult` explicitly: show the error message for 400/404/409/422, don't fail silently.
- **There's no login.** "My registration" is whatever `myRegistrations.ts` remembers. Every storage access is guarded, because storage can be unavailable. Forget the stored id on a 404.
- **Counts come from the server response**, never computed locally. After a promotion the count stays the same, and the server is the source of truth.
- **Navigation:** use `navigate()` from `router.ts` (no router library). Links must still work with a full page reload.
- **Types** match the API JSON exactly. No `any`, and no duplicate inline interfaces.
- Plain CSS files next to their component. No new UI or CSS libraries without a story asking for one.

## Checks

```bash
pnpm --filter @workshophub/app lint
pnpm --filter @workshophub/app format-check
pnpm --filter @workshophub/app build   # tsc + vite build (type check)
```

User-visible flows are covered by Playwright in `../e2e/tests/latc-*.spec.ts`. Update the matching spec when a flow changes.

import { defineConfig, devices } from '@playwright/test'
import path from 'path'

// E2E runs on its own ports and its own SQLite file so it never touches the dev environment.
export const API_PORT = 3101
export const APP_PORT = 5273
export const API_URL = `http://localhost:${API_PORT}`
const E2E_DATABASE_URL = 'file:../database/workshophub-e2e.sqlite'
const apiDir = path.resolve(__dirname, '../api')
const appDir = path.resolve(__dirname, '../app')

process.env.E2E_DATABASE_URL = E2E_DATABASE_URL

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // SLOW_MO (ms) slows each browser action down so a headed run can be watched.
    launchOptions: { slowMo: Number(process.env.SLOW_MO ?? 0) },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `pnpm exec prisma db push --force-reset --skip-generate && pnpm exec ts-node prisma/seed.ts && pnpm exec ts-node --transpile-only src/server.ts`,
      cwd: apiDir,
      url: `${API_URL}/health`,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        APP_PORT: String(API_PORT),
        NODE_ENV: 'test',
        // Unreachable on purpose: every Slack delivery fails, proving notifications are
        // fire-and-forget and never break registration (LATC-8).
        SLACK_WEBHOOK_URL: 'http://127.0.0.1:9/unreachable-slack-webhook',
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm exec vite --port ${APP_PORT} --strictPort`,
      cwd: appDir,
      url: `http://localhost:${APP_PORT}`,
      env: { VITE_API_URL: API_URL },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})

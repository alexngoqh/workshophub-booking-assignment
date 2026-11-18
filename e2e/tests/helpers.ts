import { execSync } from 'child_process'
import path from 'path'
import type { APIRequestContext } from '@playwright/test'

export const API_URL = 'http://localhost:3101'
const apiDir = path.resolve(__dirname, '../../api')

/** Re-seed the E2E database so every test starts from the same known state. */
export function resetDatabase() {
  execSync('pnpm exec ts-node prisma/seed.ts', {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL },
    stdio: 'pipe',
  })
}

export interface ApiSession {
  id: number
  title: string
  capacity: number
  registered: number
  [key: string]: unknown
}

export async function getSessions(request: APIRequestContext): Promise<ApiSession[]> {
  const res = await request.get(`${API_URL}/api/training-sessions`)
  return res.json()
}

export async function findSession(request: APIRequestContext, title: string) {
  const sessions = await getSessions(request)
  const session = sessions.find((s) => s.title === title)
  if (!session) throw new Error(`Session not found: ${title}`)
  return session
}

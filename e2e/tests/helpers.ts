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

export async function registerViaApi(
  request: APIRequestContext,
  sessionId: number,
  name: string,
  email: string
) {
  const res = await request.post(`${API_URL}/api/training-sessions/${sessionId}/registrations`, {
    data: { name, email },
  })
  return { status: res.status(), body: await res.json() }
}

/** Registers `capacity` people so the session is exactly full. */
export async function fillSession(request: APIRequestContext, title: string) {
  const session = await findSession(request, title)
  for (let i = 0; i < session.capacity; i++) {
    const res = await registerViaApi(request, session.id, `Filler ${i}`, `filler${i}@example.com`)
    if (res.status !== 201) throw new Error(`fillSession: unexpected ${res.status}`)
  }
  return session
}

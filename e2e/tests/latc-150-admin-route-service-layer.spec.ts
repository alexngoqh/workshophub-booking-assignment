import { test, expect } from './fixtures'
import { API_URL, findSession, getSessions, registerViaApi, resetDatabase } from './helpers'

const TITLE = 'Secure Coding with AI Assistance'

test.beforeEach(() => resetDatabase())

test.describe('LATC-150: admin sessions route keeps its contract after the service-layer refactor', () => {
  test('GET /api/admin/sessions returns 200 with every session ordered by date ascending', async ({
    request,
  }) => {
    const res = await request.get(`${API_URL}/api/admin/sessions`)
    expect(res.status()).toBe(200)
    const body = (await res.json()) as Array<Record<string, unknown>>
    expect(Array.isArray(body)).toBe(true)

    const publicSessions = await getSessions(request)
    expect(body.map((s) => s.id).sort()).toEqual(publicSessions.map((s) => s.id).sort())

    const dates = body.map((s) => new Date(String(s.date)).getTime())
    expect(dates).toEqual([...dates].sort((a, b) => a - b))
  })

  test('rows are raw sessions: registered and capacity present, no derived waitlisted field', async ({
    request,
  }) => {
    const res = await request.get(`${API_URL}/api/admin/sessions`)
    const body = (await res.json()) as Array<Record<string, unknown>>
    expect(body.length).toBeGreaterThan(0)
    for (const s of body) {
      expect(s).toHaveProperty('registered')
      expect(s).toHaveProperty('capacity')
      expect(s).toHaveProperty('title')
      expect(s).not.toHaveProperty('waitlisted')
      expect(typeof s.date).toBe('string')
    }
  })

  test('reflects live registration counts from the shared database', async ({ request }) => {
    const session = await findSession(request, TITLE)
    const reg = await registerViaApi(request, session.id, 'Admin Check', 'admin.check@example.com')
    expect(reg.status).toBe(201)

    const res = await request.get(`${API_URL}/api/admin/sessions`)
    const body = (await res.json()) as Array<Record<string, unknown>>
    const row = body.find((s) => s.id === session.id)
    expect(row?.registered).toBe(session.registered + 1)
  })
})

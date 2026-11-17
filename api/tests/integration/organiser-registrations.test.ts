import request from 'supertest'
import app from '../../src/app'
import prisma from '../../src/lib/prisma'
import { createTestSession, deleteTestSessions } from './helpers'

const created: number[] = []
async function session(overrides: Parameters<typeof createTestSession>[0] = {}) {
  const s = await createTestSession(overrides)
  created.push(s.id)
  return s
}

afterAll(async () => {
  await deleteTestSessions(created)
  await prisma.$disconnect()
})

const listUrl = (id: number | string) => `/api/training-sessions/${id}/registrations`

async function register(sessionId: number, who: string) {
  const res = await request(app)
    .post(listUrl(sessionId))
    .send({ name: who, email: `${who}@example.com` })
  return res.body as { id: number }
}

describe('GET /api/training-sessions/:id/registrations (LATC-6)', () => {
  it('returns confirmed and waitlisted arrays in order, excluding cancelled', async () => {
    const s = await session({ capacity: 2 })
    const a = await register(s.id, 'a')
    const b = await register(s.id, 'b')
    const c = await register(s.id, 'c') // waitlisted
    const d = await register(s.id, 'd') // waitlisted
    await request(app).delete(`${listUrl(s.id)}/${d.id}`) // cancelled

    const res = await request(app).get(listUrl(s.id))

    expect(res.status).toBe(200)
    expect(res.body.confirmed.map((r: { id: number }) => r.id)).toEqual([a.id, b.id])
    expect(res.body.waitlisted.map((r: { id: number }) => r.id)).toEqual([c.id])
    const all = [...res.body.confirmed, ...res.body.waitlisted]
    expect(all.find((r: { id: number }) => r.id === d.id)).toBeUndefined()
  })

  it('includes id, name, email, status and createdAt for each registration', async () => {
    const s = await session()
    await register(s.id, 'ada')

    const res = await request(app).get(listUrl(s.id))

    expect(res.body.confirmed[0]).toEqual({
      id: expect.any(Number),
      sessionId: s.id,
      name: 'ada',
      email: 'ada@example.com',
      status: 'confirmed',
      createdAt: expect.any(String),
    })
  })

  it('returns two empty arrays when nobody registered', async () => {
    const s = await session()
    const res = await request(app).get(listUrl(s.id))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ confirmed: [], waitlisted: [] })
  })

  it('returns 404 for an unknown session', async () => {
    const res = await request(app).get(listUrl(999999))
    expect(res.status).toBe(404)
  })

  it('returns 400 for an invalid session id', async () => {
    const res = await request(app).get(listUrl('abc'))
    expect(res.status).toBe(400)
  })
})

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

const url = (id: number | string) => `/api/training-sessions/${id}/registrations`

describe('POST /api/training-sessions/:id/registrations (LATC-2)', () => {
  it('returns 201 with registration details', async () => {
    const s = await session()
    const res = await request(app).post(url(s.id)).send({ name: 'Ada', email: 'ada@example.com' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      sessionId: s.id,
      name: 'Ada',
      email: 'ada@example.com',
      status: 'confirmed',
    })
    expect(res.body.id).toEqual(expect.any(Number))
    expect(res.body.session).toMatchObject({ registered: 1, capacity: 5 })
  })

  it('increments the registered count', async () => {
    const s = await session()
    await request(app).post(url(s.id)).send({ name: 'A', email: 'a@example.com' })
    await request(app).post(url(s.id)).send({ name: 'B', email: 'b@example.com' })

    const after = await request(app).get(`/api/training-sessions/${s.id}`)
    expect(after.body.registered).toBe(2)
  })

  it('returns 400 when fields are missing', async () => {
    const s = await session()
    const res = await request(app).post(url(s.id)).send({})
    expect(res.status).toBe(400)
    expect(res.body.details).toEqual(['name is required', 'email is required'])
  })

  it('returns 400 for a malformed email', async () => {
    const s = await session()
    const res = await request(app).post(url(s.id)).send({ name: 'Ada', email: 'not-an-email' })
    expect(res.status).toBe(400)
  })

  it('returns 400 with "name must be at most 100 characters" and does not register', async () => {
    const s = await session()
    const res = await request(app)
      .post(url(s.id))
      .send({ name: 'a'.repeat(101), email: 'ada@example.com' })

    expect(res.status).toBe(400)
    expect(res.body.details).toContain('name must be at most 100 characters')

    const after = await request(app).get(`/api/training-sessions/${s.id}`)
    expect(after.body.registered).toBe(0)
  })

  it('returns 404 when the session does not exist', async () => {
    const res = await request(app).post(url(999999)).send({ name: 'Ada', email: 'a@example.com' })
    expect(res.status).toBe(404)
  })

  it('returns 409 for a duplicate email (case-insensitive) and does not double count', async () => {
    const s = await session()
    await request(app).post(url(s.id)).send({ name: 'Ada', email: 'ada@example.com' })
    const res = await request(app).post(url(s.id)).send({ name: 'Ada', email: 'ADA@example.com ' })

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/already registered/)
    const after = await request(app).get(`/api/training-sessions/${s.id}`)
    expect(after.body.registered).toBe(1)
  })

  it('never exceeds capacity under concurrent requests; the rest are waitlisted', async () => {
    const s = await session({ capacity: 3 })
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        request(app)
          .post(url(s.id))
          .send({ name: `P${i}`, email: `p${i}@example.com` })
      )
    )

    expect(results.filter((r) => r.status === 201)).toHaveLength(3)
    const waitlisted = results.filter((r) => r.status === 202)
    expect(waitlisted).toHaveLength(5)
    expect(waitlisted.map((r) => r.body.position).sort()).toEqual([1, 2, 3, 4, 5])

    const after = await prisma.trainingSession.findUniqueOrThrow({ where: { id: s.id } })
    expect(after.registered).toBe(3)
    expect(
      await prisma.registration.count({ where: { sessionId: s.id, status: 'confirmed' } })
    ).toBe(3)
  })
})

describe('Waitlist when a session is full (LATC-3)', () => {
  it('returns 202 waitlisted with position 1 and leaves registered unchanged', async () => {
    const s = await session({ capacity: 1 })
    await request(app).post(url(s.id)).send({ name: 'A', email: 'a@example.com' })
    const res = await request(app).post(url(s.id)).send({ name: 'B', email: 'b@example.com' })

    expect(res.status).toBe(202)
    expect(res.body).toMatchObject({ status: 'waitlisted', position: 1 })
    expect(res.body.session).toMatchObject({ registered: 1, capacity: 1, waitlisted: 1 })

    const stored = await prisma.registration.findUniqueOrThrow({ where: { id: res.body.id } })
    expect(stored.status).toBe('waitlisted')
  })

  it('assigns positions 1, 2, 3 in order', async () => {
    const s = await session({ capacity: 1 })
    await request(app).post(url(s.id)).send({ name: 'A', email: 'a@example.com' })
    const positions: number[] = []
    for (const who of ['b', 'c', 'd']) {
      const res = await request(app)
        .post(url(s.id))
        .send({ name: who, email: `${who}@example.com` })
      positions.push(res.body.position)
    }
    expect(positions).toEqual([1, 2, 3])
  })

  it('tracks waitlisted separately from registered in the session payload', async () => {
    const s = await session({ capacity: 1 })
    await request(app).post(url(s.id)).send({ name: 'A', email: 'a@example.com' })
    await request(app).post(url(s.id)).send({ name: 'B', email: 'b@example.com' })
    await request(app).post(url(s.id)).send({ name: 'C', email: 'c@example.com' })

    const one = await request(app).get(`/api/training-sessions/${s.id}`)
    expect(one.body).toMatchObject({ registered: 1, capacity: 1, waitlisted: 2 })

    const all = await request(app).get('/api/training-sessions')
    expect(all.body.find((x: { id: number }) => x.id === s.id)).toMatchObject({ waitlisted: 2 })
  })

  it('rejects a duplicate email that is already on the waitlist', async () => {
    const s = await session({ capacity: 1 })
    await request(app).post(url(s.id)).send({ name: 'A', email: 'a@example.com' })
    await request(app).post(url(s.id)).send({ name: 'B', email: 'b@example.com' })
    const res = await request(app).post(url(s.id)).send({ name: 'B', email: 'B@example.com' })

    expect(res.status).toBe(409)
    expect(
      await prisma.registration.count({ where: { sessionId: s.id, status: 'waitlisted' } })
    ).toBe(1)
  })
})

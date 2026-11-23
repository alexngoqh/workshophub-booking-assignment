import request from 'supertest'
import app from '../../src/app'
import prisma from '../../src/lib/prisma'

const createdSessionIds: number[] = []

async function createSession(capacity: number, registered = 0): Promise<number> {
  const session = await prisma.trainingSession.create({
    data: {
      title: `Registration test session ${Date.now()}-${Math.random()}`,
      description: 'Created by registrations.test.ts',
      date: new Date('2099-01-01T09:00:00Z'),
      capacity,
      registered,
      location: 'Test Room',
      deliveryMode: 'online',
    },
  })
  createdSessionIds.push(session.id)
  return session.id
}

afterAll(async () => {
  await prisma.trainingSession.deleteMany({ where: { id: { in: createdSessionIds } } })
  await prisma.$disconnect()
})

describe('POST /api/training-sessions/:id/registrations', () => {
  it('returns 201 with the registration and updated session counts', async () => {
    const sessionId = await createSession(5)

    const res = await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Ada Lovelace', email: 'ada@example.com' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ sessionId, name: 'Ada Lovelace', email: 'ada@example.com' })
    expect(res.body).toHaveProperty('id')
    expect(res.body).toHaveProperty('createdAt')
    expect(res.body.status).toBe('confirmed')
    expect(res.body.session.registered).toBe(1)
    expect(res.body.session.waitlisted).toBe(0)
    const row = await prisma.registration.findUniqueOrThrow({ where: { id: res.body.id } })
    expect(row.status).toBe('confirmed')
  })

  it('increments registered by exactly 1 in the database', async () => {
    const sessionId = await createSession(5, 2)

    await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Grace Hopper', email: 'grace@example.com' })

    const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(session.registered).toBe(3)
  })

  it('trims name and email and lower-cases the email', async () => {
    const sessionId = await createSession(5)

    const res = await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: '  Alan Turing  ', email: '  Alan@Example.COM ' })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Alan Turing')
    expect(res.body.email).toBe('alan@example.com')
  })

  it('returns 400 listing each missing field', async () => {
    const sessionId = await createSession(5)

    const res = await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.details).toEqual(
      expect.arrayContaining(['name is required', 'email is required'])
    )
  })

  it('returns 400 for a blank name', async () => {
    const sessionId = await createSession(5)

    const res = await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: '  ', email: 'a@b.co' })

    expect(res.status).toBe(400)
  })

  it('returns 400 for a malformed email', async () => {
    const sessionId = await createSession(5)

    const res = await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Ada', email: 'not-an-email' })

    expect(res.status).toBe(400)
    expect(res.body.details).toContain('email is invalid')
  })

  it('returns 404 for an unknown session and creates no registration', async () => {
    const res = await request(app)
      .post('/api/training-sessions/999999/registrations')
      .send({ name: 'Ada', email: 'ada@example.com' })

    expect(res.status).toBe(404)
    expect(await prisma.registration.count({ where: { sessionId: 999999 } })).toBe(0)
  })

  it('returns 400 for a non-numeric session id', async () => {
    const res = await request(app)
      .post('/api/training-sessions/abc/registrations')
      .send({ name: 'Ada', email: 'ada@example.com' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid session ID')
  })

  it('returns 202 waitlisted for a full session without touching registered', async () => {
    const sessionId = await createSession(1, 1)

    const res = await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Ada', email: 'ada@example.com' })

    expect(res.status).toBe(202)
    expect(res.body.status).toBe('waitlisted')
    expect(res.body.position).toBe(1)
    expect(res.body.session.registered).toBe(1)
    expect(res.body.session.waitlisted).toBe(1)
    const row = await prisma.registration.findUniqueOrThrow({ where: { id: res.body.id } })
    expect(row.status).toBe('waitlisted')
  })

  it('assigns waitlist positions 1, 2, 3 in order', async () => {
    const sessionId = await createSession(1, 1)

    const positions: number[] = []
    for (const n of [1, 2, 3]) {
      const res = await request(app)
        .post(`/api/training-sessions/${sessionId}/registrations`)
        .send({ name: `Waiter ${n}`, email: `waiter${n}@example.com` })
      positions.push(res.body.position)
    }

    expect(positions).toEqual([1, 2, 3])
  })

  it('tracks the waitlisted count separately from registered', async () => {
    const sessionId = await createSession(1)

    await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Seat', email: 'seat@example.com' })
    await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Wait 1', email: 'wait1@example.com' })
    const last = await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Wait 2', email: 'wait2@example.com' })

    const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(session.registered).toBe(1)
    expect(last.body.session.waitlisted).toBe(2)
  })

  it('waitlists the first registrant of a capacity-0 session at position 1', async () => {
    const sessionId = await createSession(0)

    const res = await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Ada', email: 'ada@example.com' })

    expect(res.status).toBe(202)
    expect(res.body.position).toBe(1)
  })

  it('confirms up to capacity and waitlists the rest under concurrency', async () => {
    const sessionId = await createSession(2)

    const responses = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((n) =>
        request(app)
          .post(`/api/training-sessions/${sessionId}/registrations`)
          .send({ name: `Person ${n}`, email: `person${n}@example.com` })
      )
    )

    const statuses = responses.map((r) => r.status).sort()
    expect(statuses).toEqual([201, 201, 202, 202, 202, 202])
    const positions = responses
      .filter((r) => r.status === 202)
      .map((r) => r.body.position as number)
      .sort()
    expect(positions).toEqual([1, 2, 3, 4])
    const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(session.registered).toBe(2)
    expect(await prisma.registration.count({ where: { sessionId, status: 'confirmed' } })).toBe(2)
    expect(await prisma.registration.count({ where: { sessionId, status: 'waitlisted' } })).toBe(4)
  })
})

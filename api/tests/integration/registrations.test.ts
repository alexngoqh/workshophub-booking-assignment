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
    expect(res.body.session.registered).toBe(1)
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

  it('returns 409 for a full session and writes nothing', async () => {
    const sessionId = await createSession(1, 1)

    const res = await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Ada', email: 'ada@example.com' })

    expect(res.status).toBe(409)
    const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(session.registered).toBe(1)
    expect(await prisma.registration.count({ where: { sessionId } })).toBe(0)
  })

  it('never exceeds capacity under concurrent registrations', async () => {
    const sessionId = await createSession(1)

    const responses = await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        request(app)
          .post(`/api/training-sessions/${sessionId}/registrations`)
          .send({ name: `Person ${n}`, email: `person${n}@example.com` })
      )
    )

    const statuses = responses.map((r) => r.status).sort()
    expect(statuses).toEqual([201, 409, 409, 409, 409])
    const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(session.registered).toBe(1)
    expect(await prisma.registration.count({ where: { sessionId } })).toBe(1)
  })
})

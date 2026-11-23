import type { Server } from 'http'
import request from 'supertest'
import app from '../../src/app'
import prisma from '../../src/lib/prisma'

// One server bound to 127.0.0.1: supertest's per-request server listens on `::` but connects
// to 127.0.0.1, so another local process holding that IPv4 port can answer instead.
let server: Server

beforeAll((done) => {
  server = app.listen(0, '127.0.0.1', done)
})

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
  await new Promise((resolve) => server.close(resolve))
  await prisma.trainingSession.deleteMany({ where: { id: { in: createdSessionIds } } })
  await prisma.$disconnect()
})

describe('POST /api/training-sessions/:id/registrations', () => {
  it('returns 201 with the registration and updated session counts', async () => {
    const sessionId = await createSession(5)

    const res = await request(server)
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

    await request(server)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Grace Hopper', email: 'grace@example.com' })

    const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(session.registered).toBe(3)
  })

  it('trims name and email and lower-cases the email', async () => {
    const sessionId = await createSession(5)

    const res = await request(server)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: '  Alan Turing  ', email: '  Alan@Example.COM ' })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Alan Turing')
    expect(res.body.email).toBe('alan@example.com')
  })

  it('returns 400 listing each missing field', async () => {
    const sessionId = await createSession(5)

    const res = await request(server)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.details).toEqual(
      expect.arrayContaining(['name is required', 'email is required'])
    )
  })

  it('returns 400 for a blank name', async () => {
    const sessionId = await createSession(5)

    const res = await request(server)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: '  ', email: 'a@b.co' })

    expect(res.status).toBe(400)
  })

  it('returns 400 for a malformed email', async () => {
    const sessionId = await createSession(5)

    const res = await request(server)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Ada', email: 'not-an-email' })

    expect(res.status).toBe(400)
    expect(res.body.details).toContain('email is invalid')
  })

  it('returns 404 for an unknown session and creates no registration', async () => {
    const res = await request(server)
      .post('/api/training-sessions/999999/registrations')
      .send({ name: 'Ada', email: 'ada@example.com' })

    expect(res.status).toBe(404)
    expect(await prisma.registration.count({ where: { sessionId: 999999 } })).toBe(0)
  })

  it('returns 400 for a non-numeric session id', async () => {
    const res = await request(server)
      .post('/api/training-sessions/abc/registrations')
      .send({ name: 'Ada', email: 'ada@example.com' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid session ID')
  })

  it('returns 202 waitlisted for a full session without touching registered', async () => {
    const sessionId = await createSession(1, 1)

    const res = await request(server)
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
      const res = await request(server)
        .post(`/api/training-sessions/${sessionId}/registrations`)
        .send({ name: `Waiter ${n}`, email: `waiter${n}@example.com` })
      positions.push(res.body.position)
    }

    expect(positions).toEqual([1, 2, 3])
  })

  it('tracks the waitlisted count separately from registered', async () => {
    const sessionId = await createSession(1)

    await request(server)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Seat', email: 'seat@example.com' })
    await request(server)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Wait 1', email: 'wait1@example.com' })
    const last = await request(server)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Wait 2', email: 'wait2@example.com' })

    const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(session.registered).toBe(1)
    expect(last.body.session.waitlisted).toBe(2)
  })

  it('waitlists the first registrant of a capacity-0 session at position 1', async () => {
    const sessionId = await createSession(0)

    const res = await request(server)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Ada', email: 'ada@example.com' })

    expect(res.status).toBe(202)
    expect(res.body.position).toBe(1)
  })

  it('confirms up to capacity and waitlists the rest under concurrency', async () => {
    const sessionId = await createSession(2)

    const responses = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((n) =>
        request(server)
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

describe('cancel', () => {
  async function seed(capacity: number, confirmed: number, waitlisted: number) {
    const sessionId = await createSession(capacity, confirmed)
    const confirmedIds: number[] = []
    const waitlistedIds: number[] = []
    for (let i = 0; i < confirmed; i++) {
      const r = await prisma.registration.create({
        data: { sessionId, name: `C${i}`, email: `c${i}@example.com`, status: 'confirmed' },
      })
      confirmedIds.push(r.id)
    }
    for (let i = 0; i < waitlisted; i++) {
      const r = await prisma.registration.create({
        data: { sessionId, name: `W${i}`, email: `w${i}@example.com`, status: 'waitlisted' },
      })
      waitlistedIds.push(r.id)
    }
    return { sessionId, confirmedIds, waitlistedIds }
  }

  async function assertCounterConsistent(sessionId: number) {
    const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })
    const confirmed = await prisma.registration.count({ where: { sessionId, status: 'confirmed' } })
    expect(session.registered).toBe(confirmed)
  }

  const cancel = (sessionId: number | string, regId: number | string) =>
    request(server).delete(`/api/training-sessions/${sessionId}/registrations/${regId}`)
  const lookup = (sessionId: number | string, regId: number | string) =>
    request(server).get(`/api/training-sessions/${sessionId}/registrations/${regId}`)

  it('cancels a confirmed registration and releases one seat', async () => {
    const { sessionId, confirmedIds } = await seed(2, 2, 0)

    const res = await cancel(sessionId, confirmedIds[0])

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('cancelled')
    expect(res.body.session.registered).toBe(1)
    const row = await prisma.registration.findUniqueOrThrow({ where: { id: confirmedIds[0] } })
    expect(row.status).toBe('cancelled')
    await assertCounterConsistent(sessionId)
  })

  it('promotes the first waitlisted registration and keeps registered unchanged', async () => {
    const { sessionId, confirmedIds, waitlistedIds } = await seed(1, 1, 2)

    const res = await cancel(sessionId, confirmedIds[0])

    expect(res.body.promotedRegistrationId).toBe(waitlistedIds[0])
    expect(res.body.session.registered).toBe(1)
    expect(res.body.session.waitlisted).toBe(1)
    const first = await prisma.registration.findUniqueOrThrow({ where: { id: waitlistedIds[0] } })
    const second = await prisma.registration.findUniqueOrThrow({ where: { id: waitlistedIds[1] } })
    expect(first.status).toBe('confirmed')
    expect(second.status).toBe('waitlisted')
    await assertCounterConsistent(sessionId)

    const again = await cancel(sessionId, waitlistedIds[0])
    expect(again.body.promotedRegistrationId).toBe(waitlistedIds[1])
    await assertCounterConsistent(sessionId)
  })

  it('reports no promotion and releases the seat when the waitlist is empty', async () => {
    const { sessionId, confirmedIds } = await seed(2, 2, 0)

    const res = await cancel(sessionId, confirmedIds[0])

    expect(res.body.promotedRegistrationId).toBeNull()
    expect(res.body.session.registered).toBe(1)
  })

  it('does not promote when a waitlisted registration is cancelled', async () => {
    const { sessionId, waitlistedIds } = await seed(1, 1, 2)

    expect((await cancel(sessionId, waitlistedIds[0])).body.promotedRegistrationId).toBeNull()
  })

  it('does not promote when the session is over capacity', async () => {
    const { sessionId, confirmedIds } = await seed(2, 2, 1)
    await prisma.trainingSession.update({ where: { id: sessionId }, data: { capacity: 1 } })

    const res = await cancel(sessionId, confirmedIds[0])

    expect(res.body.promotedRegistrationId).toBeNull()
    expect(res.body.session.registered).toBe(1)
  })

  it('promotes two different people on concurrent cancellations', async () => {
    const { sessionId, confirmedIds, waitlistedIds } = await seed(2, 2, 2)

    const responses = await Promise.all(confirmedIds.map((id) => cancel(sessionId, id)))

    expect(responses.map((r) => r.status)).toEqual([200, 200])
    const promoted = responses.map((r) => r.body.promotedRegistrationId as number).sort()
    expect(promoted).toEqual([...waitlistedIds].sort())
    const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(session.registered).toBe(2)
    expect(await prisma.registration.count({ where: { sessionId, status: 'waitlisted' } })).toBe(0)
    await assertCounterConsistent(sessionId)
  })

  it('shows the promoted registration as confirmed via GET', async () => {
    const { sessionId, confirmedIds, waitlistedIds } = await seed(1, 1, 1)

    await cancel(sessionId, confirmedIds[0])

    expect((await lookup(sessionId, waitlistedIds[0])).body).toMatchObject({
      status: 'confirmed',
      position: null,
    })
  })

  it('lets a waitlisted employee leave without changing registered', async () => {
    const { sessionId, waitlistedIds } = await seed(1, 1, 2)

    const res = await cancel(sessionId, waitlistedIds[0])

    expect(res.status).toBe(200)
    expect(res.body.session.registered).toBe(1)
    expect((await lookup(sessionId, waitlistedIds[1])).body.position).toBe(1)
    await assertCounterConsistent(sessionId)
  })

  it('returns 409 for an already cancelled registration and changes nothing', async () => {
    const { sessionId, confirmedIds } = await seed(2, 2, 0)
    await cancel(sessionId, confirmedIds[0])

    const res = await cancel(sessionId, confirmedIds[0])

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('Registration is already cancelled')
    const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(session.registered).toBe(1)
  })

  it('returns 404 for an unknown registration or one from another session', async () => {
    const a = await seed(1, 1, 0)
    const b = await seed(1, 1, 0)

    expect((await cancel(a.sessionId, 999999)).status).toBe(404)
    const mismatch = await cancel(a.sessionId, b.confirmedIds[0])
    expect(mismatch.status).toBe(404)
    expect(mismatch.body.error).toBe('Registration not found')
    const row = await prisma.registration.findUniqueOrThrow({ where: { id: b.confirmedIds[0] } })
    expect(row.status).toBe('confirmed')
  })

  it('returns 400 for invalid ids', async () => {
    expect((await cancel('abc', 1)).body.error).toBe('Invalid session ID')
    expect((await cancel(1, 'abc')).body.error).toBe('Invalid registration ID')
  })

  it('cancels exactly once under a concurrent double cancel', async () => {
    const { sessionId, confirmedIds } = await seed(2, 2, 0)

    const responses = await Promise.all([
      cancel(sessionId, confirmedIds[0]),
      cancel(sessionId, confirmedIds[0]),
    ])

    expect(responses.map((r) => r.status).sort()).toEqual([200, 409])
    const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(session.registered).toBe(1)
    await assertCounterConsistent(sessionId)
  })

  it('GET returns status and position without personal data', async () => {
    const { sessionId, confirmedIds, waitlistedIds } = await seed(1, 1, 1)

    expect((await lookup(sessionId, waitlistedIds[0])).body).toEqual({
      id: waitlistedIds[0],
      sessionId,
      status: 'waitlisted',
      position: 1,
    })
    await cancel(sessionId, confirmedIds[0])
    const cancelled = await lookup(sessionId, confirmedIds[0])
    expect(cancelled.body).toMatchObject({ status: 'cancelled', position: null })
    expect(cancelled.body).not.toHaveProperty('name')
    expect(cancelled.body).not.toHaveProperty('email')
  })

  it('GET returns 404 for unknown or mismatched and 400 for invalid ids', async () => {
    const a = await seed(1, 1, 0)
    const b = await seed(1, 1, 0)

    expect((await lookup(a.sessionId, 999999)).status).toBe(404)
    expect((await lookup(a.sessionId, b.confirmedIds[0])).status).toBe(404)
    expect((await lookup('abc', 1)).status).toBe(400)
  })
})

describe('organiser list', () => {
  const list = (sessionId: number | string) =>
    request(server).get(`/api/training-sessions/${sessionId}/registrations`)

  async function add(sessionId: number, status: string, n: number) {
    const r = await prisma.registration.create({
      data: { sessionId, name: `${status}${n}`, email: `${status}${n}@example.com`, status },
    })
    return r.id
  }

  it('returns confirmed and waitlisted in queue order, excluding cancelled', async () => {
    const sessionId = await createSession(2, 2)
    const c1 = await add(sessionId, 'confirmed', 1)
    const w1 = await add(sessionId, 'waitlisted', 1)
    const x1 = await add(sessionId, 'cancelled', 1)
    const c2 = await add(sessionId, 'confirmed', 2)
    const w2 = await add(sessionId, 'waitlisted', 2)

    const res = await list(sessionId)

    expect(res.status).toBe(200)
    expect(res.body.confirmed.map((r: { id: number }) => r.id)).toEqual([c1, c2])
    expect(res.body.waitlisted.map((r: { id: number }) => r.id)).toEqual([w1, w2])
    const all = [...res.body.confirmed, ...res.body.waitlisted]
    expect(all.map((r: { id: number }) => r.id)).not.toContain(x1)
    for (const item of all) {
      expect(Object.keys(item).sort()).toEqual(['createdAt', 'email', 'id', 'name', 'status'])
    }
  })

  it('returns two empty arrays for a session without registrations', async () => {
    const sessionId = await createSession(2)

    expect((await list(sessionId)).body).toEqual({ confirmed: [], waitlisted: [] })
  })

  it('returns empty arrays when every registration is cancelled', async () => {
    const sessionId = await createSession(2)
    await add(sessionId, 'cancelled', 1)

    expect((await list(sessionId)).body).toEqual({ confirmed: [], waitlisted: [] })
  })

  it('returns 404 for an unknown session and 400 for an invalid id', async () => {
    const unknown = await list(999999)
    expect(unknown.status).toBe(404)
    expect(unknown.body.error).toBe('Training session not found')
    const invalid = await list('abc')
    expect(invalid.status).toBe(400)
    expect(invalid.body.error).toBe('Invalid session ID')
  })
})

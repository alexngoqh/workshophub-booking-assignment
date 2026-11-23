import { api } from './server'
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

const regUrl = (id: number) => `/api/training-sessions/${id}/registrations`
const oneUrl = (id: number, rid: number | string) => `${regUrl(id)}/${rid}`

async function register(sessionId: number, who: string) {
  const res = await api()
    .post(regUrl(sessionId))
    .send({ name: who, email: `${who}@example.com` })
  return res.body as { id: number; status: string; position?: number }
}

const counts = (id: number) => prisma.trainingSession.findUniqueOrThrow({ where: { id } })

describe('DELETE /api/training-sessions/:id/registrations/:registrationId (LATC-4)', () => {
  it('cancels a confirmed registration and decrements registered', async () => {
    const s = await session()
    const a = await register(s.id, 'a')
    await register(s.id, 'b')

    const res = await api().delete(oneUrl(s.id, a.id))

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: a.id, status: 'cancelled', promotedRegistrationId: null })
    expect(res.body.session).toMatchObject({ registered: 1 })
    const stored = await prisma.registration.findUniqueOrThrow({ where: { id: a.id } })
    expect(stored.status).toBe('cancelled')
    expect((await counts(s.id)).registered).toBe(1)
  })

  it('cancels a waitlisted registration without touching registered', async () => {
    const s = await session({ capacity: 1 })
    await register(s.id, 'a')
    const w = await register(s.id, 'w')
    expect(w.status).toBe('waitlisted')

    const res = await api().delete(oneUrl(s.id, w.id))

    expect(res.status).toBe(200)
    expect(res.body.promotedRegistrationId).toBeNull()
    expect(res.body.session).toMatchObject({ registered: 1, waitlisted: 0 })
  })

  it('returns 404 for an unknown registration', async () => {
    const s = await session()
    const res = await api().delete(oneUrl(s.id, 999999))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the registration belongs to another session', async () => {
    const s1 = await session()
    const s2 = await session()
    const a = await register(s1.id, 'a')

    const res = await api().delete(oneUrl(s2.id, a.id))

    expect(res.status).toBe(404)
    expect((await counts(s1.id)).registered).toBe(1)
  })

  it('returns 409 when already cancelled and only decrements once', async () => {
    const s = await session()
    const a = await register(s.id, 'a')
    await register(s.id, 'b')

    await api().delete(oneUrl(s.id, a.id))
    const again = await api().delete(oneUrl(s.id, a.id))

    expect(again.status).toBe(409)
    expect((await counts(s.id)).registered).toBe(1)
  })

  it('decrements once under concurrent cancels of the same registration', async () => {
    const s = await session()
    const a = await register(s.id, 'a')
    await register(s.id, 'b')

    const results = await Promise.all(
      Array.from({ length: 5 }, () => api().delete(oneUrl(s.id, a.id)))
    )

    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    expect((await counts(s.id)).registered).toBe(1)
  })

  it('returns 400 for a non-numeric registration id', async () => {
    const s = await session()
    const res = await api().delete(oneUrl(s.id, 'abc'))
    expect(res.status).toBe(400)
  })

  it('allows the same email to register again after cancelling', async () => {
    const s = await session()
    const a = await register(s.id, 'a')
    await api().delete(oneUrl(s.id, a.id))

    const res = await api().post(regUrl(s.id)).send({ name: 'a', email: 'a@example.com' })

    expect(res.status).toBe(201)
  })
})

describe('GET /api/training-sessions/:id/registrations/:registrationId (LATC-4)', () => {
  it('returns status and waitlist position', async () => {
    const s = await session({ capacity: 1 })
    const a = await register(s.id, 'a')
    await register(s.id, 'w1')
    const w2 = await register(s.id, 'w2')

    const confirmed = await api().get(oneUrl(s.id, a.id))
    expect(confirmed.status).toBe(200)
    expect(confirmed.body).toMatchObject({ status: 'confirmed', position: null, name: 'a' })

    const waiting = await api().get(oneUrl(s.id, w2.id))
    expect(waiting.body).toMatchObject({ status: 'waitlisted', position: 2 })
  })

  it('returns 404 for an unknown registration', async () => {
    const s = await session()
    const res = await api().get(oneUrl(s.id, 999999))
    expect(res.status).toBe(404)
  })
})

describe('Promote first waitlisted employee after cancellation (LATC-5)', () => {
  const status = async (id: number) =>
    (await prisma.registration.findUniqueOrThrow({ where: { id } })).status

  it('promotes the earliest waitlisted registration and keeps registered unchanged', async () => {
    const s = await session({ capacity: 1 })
    const a = await register(s.id, 'a')
    const w1 = await register(s.id, 'w1')
    const w2 = await register(s.id, 'w2')

    const res = await api().delete(oneUrl(s.id, a.id))

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'cancelled', promotedRegistrationId: w1.id })
    expect(res.body.session).toMatchObject({ registered: 1, capacity: 1, waitlisted: 1 })
    expect(await status(w1.id)).toBe('confirmed')
    expect(await status(w2.id)).toBe('waitlisted')

    const w2Now = await api().get(oneUrl(s.id, w2.id))
    expect(w2Now.body.position).toBe(1)
  })

  it('decrements registered when nobody is waitlisted', async () => {
    const s = await session({ capacity: 2 })
    const a = await register(s.id, 'a')
    await register(s.id, 'b')

    const res = await api().delete(oneUrl(s.id, a.id))

    expect(res.body.promotedRegistrationId).toBeNull()
    expect(res.body.session.registered).toBe(1)
  })

  it('cancelling a waitlisted registration never promotes anyone', async () => {
    const s = await session({ capacity: 1 })
    await register(s.id, 'a')
    const w1 = await register(s.id, 'w1')
    const w2 = await register(s.id, 'w2')

    const res = await api().delete(oneUrl(s.id, w1.id))

    expect(res.body.promotedRegistrationId).toBeNull()
    expect(await status(w2.id)).toBe('waitlisted')
    expect(res.body.session).toMatchObject({ registered: 1, waitlisted: 1 })
  })

  it('concurrent cancellations promote distinct registrations and never exceed capacity', async () => {
    const s = await session({ capacity: 3 })
    const confirmed = [
      await register(s.id, 'c1'),
      await register(s.id, 'c2'),
      await register(s.id, 'c3'),
    ]
    const waiting = [await register(s.id, 'w1'), await register(s.id, 'w2')]

    const results = await Promise.all(confirmed.map((c) => api().delete(oneUrl(s.id, c.id))))

    const promoted = results.map((r) => r.body.promotedRegistrationId).filter((x) => x !== null)
    expect(promoted.sort()).toEqual(waiting.map((w) => w.id).sort())
    const after = await counts(s.id)
    expect(after.registered).toBe(2)
    expect(
      await prisma.registration.count({ where: { sessionId: s.id, status: 'confirmed' } })
    ).toBe(2)
    expect(
      await prisma.registration.count({ where: { sessionId: s.id, status: 'waitlisted' } })
    ).toBe(0)
  })
})

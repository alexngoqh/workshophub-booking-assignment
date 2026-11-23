import { api } from './server'
import prisma from '../../src/lib/prisma'
import { registerForSession } from '../../src/services/registrationService'
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

const url = (id: number) => `/api/training-sessions/${id}/registrations`
const HOUR = 60 * 60 * 1000

describe('Registration deadline (LATC-7)', () => {
  it('allows registration before the deadline', async () => {
    const s = await session({ registrationDeadline: new Date(Date.now() + HOUR) })
    const res = await api().post(url(s.id)).send({ name: 'A', email: 'a@example.com' })
    expect(res.status).toBe(201)
  })

  it('rejects registration after the deadline with 422 and changes nothing', async () => {
    const s = await session({ registrationDeadline: new Date(Date.now() - HOUR) })
    const res = await api().post(url(s.id)).send({ name: 'A', email: 'a@example.com' })

    expect(res.status).toBe(422)
    expect(res.body).toEqual({ error: 'Registration deadline has passed' })
    const after = await prisma.trainingSession.findUniqueOrThrow({ where: { id: s.id } })
    expect(after.registered).toBe(0)
    expect(await prisma.registration.count({ where: { sessionId: s.id } })).toBe(0)
  })

  it('also blocks joining the waitlist of a full session after the deadline', async () => {
    const s = await session({ capacity: 1 })
    await api().post(url(s.id)).send({ name: 'A', email: 'a@example.com' })
    await prisma.trainingSession.update({
      where: { id: s.id },
      data: { registrationDeadline: new Date(Date.now() - HOUR) },
    })

    const res = await api().post(url(s.id)).send({ name: 'B', email: 'b@example.com' })

    expect(res.status).toBe(422)
    expect(
      await prisma.registration.count({ where: { sessionId: s.id, status: 'waitlisted' } })
    ).toBe(0)
  })

  it('allows registration at any time when there is no deadline', async () => {
    const s = await session({ registrationDeadline: null })
    const res = await api().post(url(s.id)).send({ name: 'A', email: 'a@example.com' })
    expect(res.status).toBe(201)
  })

  it('uses the server clock: exactly at the deadline is still allowed, 1ms after is not', async () => {
    const deadline = new Date('2030-01-01T00:00:00Z')
    const s = await session({ registrationDeadline: deadline })

    const atDeadline = await registerForSession(
      s.id,
      { name: 'A', email: 'a@example.com' },
      deadline
    )
    expect(atDeadline.kind).toBe('confirmed')

    const late = await registerForSession(
      s.id,
      { name: 'B', email: 'b@example.com' },
      new Date(deadline.getTime() + 1)
    )
    expect(late.kind).toBe('deadline_passed')
  })

  it('still validates the body before checking the deadline', async () => {
    const s = await session({ registrationDeadline: new Date(Date.now() - HOUR) })
    const res = await api().post(url(s.id)).send({})
    expect(res.status).toBe(400)
  })

  it('exposes registrationDeadline in the session payloads', async () => {
    const deadline = new Date('2030-05-01T09:00:00Z')
    const s = await session({ registrationDeadline: deadline })
    const one = await api().get(`/api/training-sessions/${s.id}`)
    expect(one.body.registrationDeadline).toBe(deadline.toISOString())

    const none = await session()
    const all = await api().get('/api/training-sessions')
    const found = all.body.find((x: { id: number }) => x.id === none.id)
    expect(found).toHaveProperty('registrationDeadline', null)
  })
})

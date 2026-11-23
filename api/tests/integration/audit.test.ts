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
const auditUrl = (id: number, rid: number | string) => `${regUrl(id)}/${rid}/audit`

async function register(sessionId: number, who: string) {
  const res = await api()
    .post(regUrl(sessionId))
    .send({ name: who, email: `${who}@example.com` })
  return res.body as { id: number; status: string }
}

const transitions = async (sessionId: number, registrationId: number) => {
  const res = await api().get(auditUrl(sessionId, registrationId))
  return (res.body as { fromStatus: string | null; toStatus: string; reason: string }[]).map(
    (e) => [e.fromStatus, e.toStatus, e.reason]
  )
}

describe('Audit log for registration state changes (LATC-9)', () => {
  it('records registration as null -> confirmed', async () => {
    const s = await session()
    const a = await register(s.id, 'a')

    const res = await api().get(auditUrl(s.id, a.id))

    expect(res.status).toBe(200)
    expect(res.body).toEqual([
      {
        id: expect.any(Number),
        registrationId: a.id,
        fromStatus: null,
        toStatus: 'confirmed',
        changedAt: expect.any(String),
        reason: 'registered',
      },
    ])
  })

  it('records waitlisting as null -> waitlisted', async () => {
    const s = await session({ capacity: 1 })
    await register(s.id, 'a')
    const w = await register(s.id, 'w')
    expect(await transitions(s.id, w.id)).toEqual([[null, 'waitlisted', 'waitlisted']])
  })

  it('records cancellation as confirmed -> cancelled', async () => {
    const s = await session()
    const a = await register(s.id, 'a')
    await api().delete(`${regUrl(s.id)}/${a.id}`)
    expect(await transitions(s.id, a.id)).toEqual([
      [null, 'confirmed', 'registered'],
      ['confirmed', 'cancelled', 'cancelled'],
    ])
  })

  it('records the full waitlisted -> promoted -> cancelled lifecycle in order', async () => {
    const s = await session({ capacity: 1 })
    const a = await register(s.id, 'a')
    const w = await register(s.id, 'w')
    await api().delete(`${regUrl(s.id)}/${a.id}`) // promotes w
    await api().delete(`${regUrl(s.id)}/${w.id}`) // w cancels

    expect(await transitions(s.id, w.id)).toEqual([
      [null, 'waitlisted', 'waitlisted'],
      ['waitlisted', 'confirmed', 'promoted'],
      ['confirmed', 'cancelled', 'cancelled'],
    ])
    expect(await transitions(s.id, a.id)).toEqual([
      [null, 'confirmed', 'registered'],
      ['confirmed', 'cancelled', 'cancelled'],
    ])
  })

  it('writes no entry for rejected requests', async () => {
    const s = await session({ capacity: 1 })
    const a = await register(s.id, 'a')
    await api().post(regUrl(s.id)).send({ name: 'a', email: 'a@example.com' }) // duplicate
    await api().delete(`${regUrl(s.id)}/${a.id}`)
    await api().delete(`${regUrl(s.id)}/${a.id}`) // already cancelled

    const closed = await session({ registrationDeadline: new Date(Date.now() - 60_000) })
    await api().post(regUrl(closed.id)).send({ name: 'z', email: 'z@example.com' })

    expect(await transitions(s.id, a.id)).toHaveLength(2)
    const total = await prisma.auditLog.count({
      where: { registration: { sessionId: { in: [s.id, closed.id] } } },
    })
    expect(total).toBe(2)
  })

  it('returns 404 for an unknown registration and for another session', async () => {
    const s1 = await session()
    const s2 = await session()
    const a = await register(s1.id, 'a')
    expect((await api().get(auditUrl(s1.id, 999999))).status).toBe(404)
    expect((await api().get(auditUrl(s2.id, a.id))).status).toBe(404)
  })

  it('returns 400 for a non-numeric registration id', async () => {
    const s = await session()
    expect((await api().get(auditUrl(s.id, 'abc'))).status).toBe(400)
  })

  it('offers no way to modify or delete audit entries', async () => {
    const s = await session()
    const a = await register(s.id, 'a')
    const before = await api().get(auditUrl(s.id, a.id))

    for (const method of ['put', 'patch', 'delete', 'post'] as const) {
      const res = await api()[method](auditUrl(s.id, a.id)).send({ toStatus: 'cancelled' })
      expect(res.status).toBe(404)
    }

    const after = await api().get(auditUrl(s.id, a.id))
    expect(after.body).toEqual(before.body)
  })
})

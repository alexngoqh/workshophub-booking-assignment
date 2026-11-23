import request from 'supertest'
import app from '../../src/app'
import prisma from '../../src/lib/prisma'
import { createTestSession, deleteTestSessions } from './helpers'
import { failInsideTransactions } from './faultInjection'

const created: number[] = []
async function session(capacity = 5) {
  const s = await createTestSession({ capacity })
  created.push(s.id)
  return s
}

let restore: (() => void) | null = null
beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => {
  restore?.()
  restore = null
  jest.restoreAllMocks()
})
afterAll(async () => {
  await deleteTestSessions(created)
  await prisma.$disconnect()
})

const url = (id: number) => `/api/training-sessions/${id}/registrations`
const registered = async (id: number) =>
  (await prisma.trainingSession.findUniqueOrThrow({ where: { id } })).registered
const statusOf = async (id: number) =>
  (await prisma.registration.findUniqueOrThrow({ where: { id } })).status
const auditCount = (registrationId: number) => prisma.auditLog.count({ where: { registrationId } })

describe('Cancellation and promotion are atomic (LATC-5)', () => {
  it('a failure while promoting rolls back the cancellation as well', async () => {
    const s = await session(1)
    const a = (await request(app).post(url(s.id)).send({ name: 'A', email: 'a@example.com' })).body
    const w = (await request(app).post(url(s.id)).send({ name: 'W', email: 'w@example.com' })).body
    expect(w.status).toBe('waitlisted')

    // Fail exactly at the promotion step (waitlisted -> confirmed), after the cancel happened.
    restore = failInsideTransactions(
      (model, method, args) =>
        model === 'registration' &&
        method === 'updateMany' &&
        (args as { data: { status?: string } }).data.status === 'confirmed'
    )

    const res = await request(app).delete(`${url(s.id)}/${a.id}`)

    expect(res.status).toBe(500)
    // No partial state: A is still confirmed, W still waitlisted, seat count unchanged.
    expect(await statusOf(a.id)).toBe('confirmed')
    expect(await statusOf(w.id)).toBe('waitlisted')
    expect(await registered(s.id)).toBe(1)
    expect(await auditCount(a.id)).toBe(1)
    expect(await auditCount(w.id)).toBe(1)
  })

  it('the same cancellation succeeds once the failure is gone', async () => {
    const s = await session(1)
    const a = (await request(app).post(url(s.id)).send({ name: 'A', email: 'a@example.com' })).body
    const w = (await request(app).post(url(s.id)).send({ name: 'W', email: 'w@example.com' })).body

    const res = await request(app).delete(`${url(s.id)}/${a.id}`)

    expect(res.status).toBe(200)
    expect(res.body.promotedRegistrationId).toBe(w.id)
  })
})

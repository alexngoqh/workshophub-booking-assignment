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

describe('Audit entry is atomic with the state change (LATC-9)', () => {
  it('registration is rolled back when writing its audit entry fails', async () => {
    const s = await session()
    restore = failInsideTransactions((model, method) => model === 'auditLog' && method === 'create')

    const res = await request(app).post(url(s.id)).send({ name: 'A', email: 'a@example.com' })

    expect(res.status).toBe(500)
    expect(await prisma.registration.count({ where: { sessionId: s.id } })).toBe(0)
    expect(await registered(s.id)).toBe(0) // seat claim rolled back too
  })

  it('cancellation is rolled back when writing its audit entry fails', async () => {
    const s = await session()
    const a = (await request(app).post(url(s.id)).send({ name: 'A', email: 'a@example.com' })).body
    restore = failInsideTransactions(
      (model, method, args) =>
        model === 'auditLog' &&
        method === 'create' &&
        (args as { data: { toStatus: string } }).data.toStatus === 'cancelled'
    )

    const res = await request(app).delete(`${url(s.id)}/${a.id}`)

    expect(res.status).toBe(500)
    expect(await statusOf(a.id)).toBe('confirmed')
    expect(await registered(s.id)).toBe(1)
    expect(await auditCount(a.id)).toBe(1) // only the original "registered" entry
  })
})

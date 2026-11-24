import { api } from './server'
import prisma from '../../src/lib/prisma'
import {
  flushNotifications,
  RegistrationNotification,
  setTransportsForTesting,
} from '../../src/notifications'
import { createTestSession, deleteTestSessions } from './helpers'
import { failInsideTransactions } from './faultInjection'

// Guards the notification side-effect (LATC-8): an event may only go out for a change that
// actually committed. Each test fails the transaction at its LAST write (the AuditLog row),
// after the registration row was written, then asserts that nothing was sent.
// Moving notify() inside the transaction, or before the audit write, makes these tests fail.

const created: number[] = []
let sent: RegistrationNotification[] = []
let restore: (() => void) | null = null

beforeEach(() => {
  sent = []
  setTransportsForTesting([async (e) => void sent.push(e)])
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  restore?.()
  restore = null
  jest.restoreAllMocks()
})

afterAll(async () => {
  setTransportsForTesting(null)
  await deleteTestSessions(created)
  await prisma.$disconnect()
})

async function session(capacity = 5) {
  const s = await createTestSession({ capacity })
  created.push(s.id)
  return s
}

const url = (id: number) => `/api/training-sessions/${id}/registrations`

type AuditCreate = { data: { toStatus?: string } }
const isAuditWrite = (model: string, method: string) => model === 'auditLog' && method === 'create'

describe('Confirmed notification only follows a committed registration (LATC-8)', () => {
  it('sends no confirmed notification when the registration rolls back', async () => {
    const s = await session(5)
    restore = failInsideTransactions(
      (model, method, args) =>
        isAuditWrite(model, method) && (args as AuditCreate).data.toStatus === 'confirmed'
    )

    const res = await api().post(url(s.id)).send({ name: 'Rollback', email: 'rb@example.com' })
    await flushNotifications()

    expect(res.status).toBe(500)
    expect(await prisma.registration.count({ where: { sessionId: s.id } })).toBe(0)
    expect(sent).toEqual([])
  })
})

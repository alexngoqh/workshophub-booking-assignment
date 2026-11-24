import { api } from './server'
import prisma from '../../src/lib/prisma'
import {
  flushNotifications,
  RegistrationNotification,
  setTransportsForTesting,
} from '../../src/notifications'
import { createTestSession, deleteTestSessions } from './helpers'

const created: number[] = []
let sent: RegistrationNotification[] = []

beforeEach(() => {
  sent = []
  setTransportsForTesting([async (e) => void sent.push(e)])
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

describe('Registration notifications (LATC-8)', () => {
  it('emits a confirmed notification with employee and session details', async () => {
    const s = await session()
    const res = await api().post(url(s.id)).send({ name: 'Ada', email: 'ada@example.com' })
    await flushNotifications()

    expect(res.status).toBe(201)
    expect(sent).toEqual([
      {
        name: 'Ada',
        email: 'ada@example.com',
        sessionTitle: s.title,
        sessionDate: s.date,
        status: 'confirmed',
      },
    ])
  })

  it('does not notify when the employee is only waitlisted', async () => {
    const s = await session(1)
    await api().post(url(s.id)).send({ name: 'A', email: 'a@example.com' })
    sent = []
    const res = await api().post(url(s.id)).send({ name: 'B', email: 'b@example.com' })
    await flushNotifications()

    expect(res.status).toBe(202)
    expect(sent).toEqual([])
  })

  it('emits a promoted notification for the promoted employee', async () => {
    const s = await session(1)
    const a = await api().post(url(s.id)).send({ name: 'A', email: 'a@example.com' })
    await api().post(url(s.id)).send({ name: 'Wendy', email: 'wendy@example.com' })
    await flushNotifications()
    sent = []

    await api().delete(`${url(s.id)}/${a.body.id}`)
    await flushNotifications()

    expect(sent).toEqual([
      expect.objectContaining({ name: 'Wendy', email: 'wendy@example.com', status: 'promoted' }),
    ])
  })

  it('does not notify when a cancellation promotes nobody', async () => {
    const s = await session()
    const a = await api().post(url(s.id)).send({ name: 'A', email: 'a@example.com' })
    await flushNotifications()
    sent = []

    await api().delete(`${url(s.id)}/${a.body.id}`)
    await flushNotifications()

    expect(sent).toEqual([])
  })

  it('emits exactly one confirmed event with normalised email and a Date sessionDate', async () => {
    const s = await session()
    const res = await api().post(url(s.id)).send({ name: 'Grace', email: '  Grace@Example.COM ' })
    await flushNotifications()

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('confirmed')
    expect(sent).toHaveLength(1)
    expect(sent[0].status).toBe('confirmed')
    expect(sent[0].name).toBe('Grace')
    expect(sent[0].email).toBe('grace@example.com')
    expect(sent[0].sessionTitle).toBe(s.title)
    expect(sent[0].sessionDate).toBeInstanceOf(Date)
    expect(sent[0].sessionDate.getTime()).toBe(s.date.getTime())
  })

  it('responds 201 without waiting for a transport that never resolves', async () => {
    let release: () => void = () => {}
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const calls: RegistrationNotification[] = []
    setTransportsForTesting([
      (e) => {
        calls.push(e)
        return pending
      },
    ])
    const s = await session()

    try {
      const started = Date.now()
      const res = await api().post(url(s.id)).send({ name: 'Ada', email: 'ada@example.com' })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('confirmed')
      expect(Date.now() - started).toBeLessThan(2000)
    } finally {
      release()
      await flushNotifications()
    }
    expect(calls).toHaveLength(1)
  })

  it('does not notify on a 400 validation error', async () => {
    const s = await session()
    const res = await api().post(url(s.id)).send({ name: '', email: 'not-an-email' })
    await flushNotifications()

    expect(res.status).toBe(400)
    expect(sent).toEqual([])
  })

  it('does not notify on a 404 unknown session', async () => {
    const res = await api().post(url(999999999)).send({ name: 'Ada', email: 'ada@example.com' })
    await flushNotifications()

    expect(res.status).toBe(404)
    expect(sent).toEqual([])
  })

  it('a failing transport does not affect the registration', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    setTransportsForTesting([
      async () => {
        throw new Error('notification service down')
      },
    ])
    const s = await session()

    const res = await api().post(url(s.id)).send({ name: 'Ada', email: 'ada@example.com' })
    await flushNotifications()

    expect(res.status).toBe(201)
    expect(await prisma.registration.count({ where: { sessionId: s.id } })).toBe(1)
    jest.restoreAllMocks()
  })
})

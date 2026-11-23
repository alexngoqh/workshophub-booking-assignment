import request from 'supertest'
import app from '../../src/app'
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
    const res = await request(app).post(url(s.id)).send({ name: 'Ada', email: 'ada@example.com' })
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
    await request(app).post(url(s.id)).send({ name: 'A', email: 'a@example.com' })
    sent = []
    const res = await request(app).post(url(s.id)).send({ name: 'B', email: 'b@example.com' })
    await flushNotifications()

    expect(res.status).toBe(202)
    expect(sent).toEqual([])
  })

  it('emits a promoted notification for the promoted employee', async () => {
    const s = await session(1)
    const a = await request(app).post(url(s.id)).send({ name: 'A', email: 'a@example.com' })
    await request(app).post(url(s.id)).send({ name: 'Wendy', email: 'wendy@example.com' })
    await flushNotifications()
    sent = []

    await request(app).delete(`${url(s.id)}/${a.body.id}`)
    await flushNotifications()

    expect(sent).toEqual([
      expect.objectContaining({ name: 'Wendy', email: 'wendy@example.com', status: 'promoted' }),
    ])
  })

  it('does not notify when a cancellation promotes nobody', async () => {
    const s = await session()
    const a = await request(app).post(url(s.id)).send({ name: 'A', email: 'a@example.com' })
    await flushNotifications()
    sent = []

    await request(app).delete(`${url(s.id)}/${a.body.id}`)
    await flushNotifications()

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

    const res = await request(app).post(url(s.id)).send({ name: 'Ada', email: 'ada@example.com' })
    await flushNotifications()

    expect(res.status).toBe(201)
    expect(await prisma.registration.count({ where: { sessionId: s.id } })).toBe(1)
    jest.restoreAllMocks()
  })
})

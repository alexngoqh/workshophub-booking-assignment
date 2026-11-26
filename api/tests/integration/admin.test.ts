import prisma from '../../src/lib/prisma'
import { api } from './server'
import { createTestSession, deleteTestSessions } from './helpers'

describe('GET /api/admin/sessions', () => {
  const createdIds: number[] = []

  afterAll(async () => {
    await deleteTestSessions(createdIds)
  })

  it('returns 200 with raw sessions ordered by date ascending, without waitlisted', async () => {
    // Later-dated session created first so insertion order differs from date order.
    const later = await createTestSession({ capacity: 7, registered: 2 })
    createdIds.push(later.id)
    await prisma.trainingSession.update({
      where: { id: later.id },
      data: { date: new Date('2099-06-02T09:00:00Z') },
    })
    const earlier = await createTestSession({ capacity: 4, registered: 1 })
    createdIds.push(earlier.id)
    await prisma.trainingSession.update({
      where: { id: earlier.id },
      data: { date: new Date('2099-06-01T09:00:00Z') },
    })

    const res = await api().get('/api/admin/sessions')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)

    const body = res.body as Array<Record<string, unknown>>
    const earlierIdx = body.findIndex((s) => s.id === earlier.id)
    const laterIdx = body.findIndex((s) => s.id === later.id)
    expect(earlierIdx).toBeGreaterThanOrEqual(0)
    expect(laterIdx).toBeGreaterThanOrEqual(0)
    expect(earlierIdx).toBeLessThan(laterIdx)

    const earlierRow = body[earlierIdx]
    const laterRow = body[laterIdx]
    for (const row of [earlierRow, laterRow]) {
      expect(row).not.toHaveProperty('waitlisted')
      expect(row).toHaveProperty('registered')
      expect(row).toHaveProperty('capacity')
    }
    expect(earlierRow.capacity).toBe(4)
    expect(earlierRow.registered).toBe(1)
    expect(laterRow.capacity).toBe(7)
    expect(laterRow.registered).toBe(2)
  })
})

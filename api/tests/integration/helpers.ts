import prisma from '../../src/lib/prisma'

let counter = 0

/** Creates an isolated session for a test; dated far in the future so it never sorts first. */
export async function createTestSession(
  overrides: Partial<{ capacity: number; registered: number; title: string }> = {}
) {
  counter += 1
  return prisma.trainingSession.create({
    data: {
      title: overrides.title ?? `Integration test session ${Date.now()}-${counter}`,
      description: 'Created by integration tests',
      date: new Date('2099-01-01T09:00:00Z'),
      capacity: overrides.capacity ?? 5,
      registered: overrides.registered ?? 0,
      location: 'Test room',
      deliveryMode: 'online',
      status: 'active',
    },
  })
}

export async function deleteTestSessions(ids: number[]) {
  if (ids.length === 0) return
  await prisma.trainingSession.deleteMany({ where: { id: { in: ids } } })
}

import prisma from '../lib/prisma'

// Adds a flat `waitlisted` count next to the stored `registered` counter.
const withWaitlistCount = {
  _count: { select: { registrations: { where: { status: 'waitlisted' } } } },
} as const

type SessionWithCount = {
  _count: { registrations: number }
  [key: string]: unknown
}

function flatten<T extends SessionWithCount>(session: T) {
  const { _count, ...rest } = session
  return { ...rest, waitlisted: _count.registrations }
}

export async function getAllSessions() {
  const sessions = await prisma.trainingSession.findMany({
    orderBy: { date: 'asc' },
    include: withWaitlistCount,
  })
  return sessions.map(flatten)
}

export async function getSessionById(id: number) {
  const session = await prisma.trainingSession.findUnique({
    where: { id },
    include: withWaitlistCount,
  })
  return session ? flatten(session) : null
}

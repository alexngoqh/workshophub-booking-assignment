import prisma from '../lib/prisma'

export const REGISTRATION_STATUS = {
  confirmed: 'confirmed',
  waitlisted: 'waitlisted',
  cancelled: 'cancelled',
} as const

export type RegistrationStatus = (typeof REGISTRATION_STATUS)[keyof typeof REGISTRATION_STATUS]

export interface RegistrationInput {
  name: string
  email: string
}

export interface SessionCounts {
  id: number
  title: string
  registered: number
  capacity: number
  waitlisted: number
}

export interface RegistrationDetails {
  id: number
  sessionId: number
  name: string
  email: string
  status: RegistrationStatus
  createdAt: Date
}

export type RegisterResult =
  | { kind: 'session_not_found' }
  | { kind: 'confirmed'; registration: RegistrationDetails; session: SessionCounts }
  | {
      kind: 'waitlisted'
      registration: RegistrationDetails
      position: number
      session: SessionCounts
    }

export type CancelResult =
  | { kind: 'not_found' }
  | { kind: 'already_cancelled' }
  | {
      kind: 'cancelled'
      registration: RegistrationDetails
      promoted: RegistrationDetails | null
      session: SessionCounts
    }

export interface RegistrationStatusView {
  id: number
  sessionId: number
  status: RegistrationStatus
  position: number | null
}

export type RegistrationLookupResult =
  | { kind: 'not_found' }
  | { kind: 'found'; view: RegistrationStatusView }

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

interface RegistrationRow {
  id: number
  sessionId: number
  name: string
  email: string
  status: string
  createdAt: Date
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRegistrationInput(body: unknown): string[] {
  // Untyped request body: narrow cast, every field is checked below.
  const input = (body ?? {}) as Record<string, unknown>
  const errors: string[] = []

  if (typeof input.name !== 'string' || input.name.trim() === '') {
    errors.push('name is required')
  }

  if (typeof input.email !== 'string' || input.email.trim() === '') {
    errors.push('email is required')
  } else if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.push('email is invalid')
  }

  return errors
}

function details(row: RegistrationRow): RegistrationDetails {
  return {
    id: row.id,
    sessionId: row.sessionId,
    name: row.name,
    email: row.email,
    status: row.status as RegistrationStatus,
    createdAt: row.createdAt,
  }
}

// Position is derived (never stored): 1-based rank by id among the session's waitlisted rows.
async function waitlistPosition(
  tx: Tx | typeof prisma,
  sessionId: number,
  registrationId: number
): Promise<number> {
  return tx.registration.count({
    where: { sessionId, status: REGISTRATION_STATUS.waitlisted, id: { lte: registrationId } },
  })
}

async function sessionCounts(tx: Tx, sessionId: number): Promise<SessionCounts> {
  const session = await tx.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })
  const waitlisted = await tx.registration.count({
    where: { sessionId, status: REGISTRATION_STATUS.waitlisted },
  })
  return {
    id: session.id,
    title: session.title,
    registered: session.registered,
    capacity: session.capacity,
    waitlisted,
  }
}

export async function registerForSession(
  sessionId: number,
  input: RegistrationInput
): Promise<RegisterResult> {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()

  return prisma.$transaction(
    async (tx) => {
      const session = await tx.trainingSession.findUnique({ where: { id: sessionId } })
      if (!session) {
        return { kind: 'session_not_found' }
      }

      // Conditional update claims a seat atomically, so concurrent requests can never
      // push registered past capacity.
      const claimed = await tx.trainingSession.updateMany({
        where: { id: sessionId, registered: { lt: session.capacity } },
        data: { registered: { increment: 1 } },
      })

      if (claimed.count === 0) {
        // No seat: join the waitlist. registered counts confirmed seats only, so it is not touched.
        const reg = await tx.registration.create({
          data: { sessionId, name, email, status: REGISTRATION_STATUS.waitlisted },
        })
        return {
          kind: 'waitlisted',
          registration: details(reg),
          position: await waitlistPosition(tx, sessionId, reg.id),
          session: await sessionCounts(tx, sessionId),
        }
      }

      const reg = await tx.registration.create({
        data: { sessionId, name, email, status: REGISTRATION_STATUS.confirmed },
      })
      return {
        kind: 'confirmed',
        registration: details(reg),
        session: await sessionCounts(tx, sessionId),
      }
    },
    { maxWait: 5000, timeout: 10000 }
  )
}

// Release one confirmed seat, never below 0. Used when nobody is promoted into it (LATC-89).
async function releaseSeat(tx: Tx, sessionId: number): Promise<void> {
  await tx.trainingSession.updateMany({
    where: { id: sessionId, registered: { gt: 0 } },
    data: { registered: { decrement: 1 } },
  })
}

// Promote the head of the session's waitlist. Ordered by id to match the position shown by
// LATC-87. The status-conditional update means a concurrent promoter can't win the same row;
// on a lost race, retry once with the next head.
async function promoteNext(tx: Tx, sessionId: number): Promise<RegistrationDetails | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const head = await tx.registration.findFirst({
      where: { sessionId, status: REGISTRATION_STATUS.waitlisted },
      orderBy: { id: 'asc' },
    })
    if (!head) {
      return null
    }

    const won = await tx.registration.updateMany({
      where: { id: head.id, status: REGISTRATION_STATUS.waitlisted },
      data: { status: REGISTRATION_STATUS.confirmed },
    })
    if (won.count === 1) {
      return details({ ...head, status: REGISTRATION_STATUS.confirmed })
    }
  }
  return null
}

export async function cancelRegistration(
  sessionId: number,
  registrationId: number
): Promise<CancelResult> {
  return prisma.$transaction(
    async (tx) => {
      const reg = await tx.registration.findFirst({ where: { id: registrationId, sessionId } })
      if (!reg) {
        return { kind: 'not_found' }
      }
      if (reg.status === REGISTRATION_STATUS.cancelled) {
        return { kind: 'already_cancelled' }
      }

      const done = await tx.registration.updateMany({
        where: { id: reg.id, status: reg.status },
        data: { status: REGISTRATION_STATUS.cancelled },
      })
      if (done.count === 0) {
        return { kind: 'already_cancelled' }
      }

      let promoted: RegistrationDetails | null = null

      if (reg.status === REGISTRATION_STATUS.confirmed) {
        const session = await tx.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })
        // Only hand the seat on if the session is not over capacity (e.g. after an admin
        // lowered capacity).
        if (session.registered - 1 < session.capacity) {
          promoted = await promoteNext(tx, sessionId)
        }
        // With a promotion the freed seat is refilled, so registered is not written at all
        // (net zero). Without one, release the seat.
        if (promoted === null) {
          await releaseSeat(tx, sessionId)
        }
      }

      // LATC-8: notify promoted employee here (out of scope for LATC-89)

      return {
        kind: 'cancelled',
        registration: details({ ...reg, status: REGISTRATION_STATUS.cancelled }),
        promoted,
        session: await sessionCounts(tx, sessionId),
      }
    },
    { maxWait: 5000, timeout: 10000 }
  )
}

export async function getRegistrationStatus(
  sessionId: number,
  registrationId: number
): Promise<RegistrationLookupResult> {
  const reg = await prisma.registration.findFirst({
    where: { id: registrationId, sessionId },
    select: { id: true, sessionId: true, status: true },
  })
  if (!reg) {
    return { kind: 'not_found' }
  }

  const status = reg.status as RegistrationStatus
  const position =
    status === REGISTRATION_STATUS.waitlisted
      ? await waitlistPosition(prisma, sessionId, reg.id)
      : null

  return { kind: 'found', view: { id: reg.id, sessionId: reg.sessionId, status, position } }
}

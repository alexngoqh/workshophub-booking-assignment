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
  tx: Tx,
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

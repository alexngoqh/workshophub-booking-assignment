import prisma from '../lib/prisma'

export interface RegistrationInput {
  name: string
  email: string
}

export interface SessionCounts {
  id: number
  title: string
  registered: number
  capacity: number
}

export interface RegistrationDetails {
  id: number
  sessionId: number
  name: string
  email: string
  createdAt: Date
}

export type RegisterResult =
  | { kind: 'session_not_found' }
  | { kind: 'session_full' }
  | { kind: 'registered'; registration: RegistrationDetails; session: SessionCounts }

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
        return { kind: 'session_full' }
      }

      const registration = await tx.registration.create({ data: { sessionId, name, email } })
      const updated = await tx.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })

      return {
        kind: 'registered',
        registration: {
          id: registration.id,
          sessionId: registration.sessionId,
          name: registration.name,
          email: registration.email,
          createdAt: registration.createdAt,
        },
        session: {
          id: updated.id,
          title: updated.title,
          registered: updated.registered,
          capacity: updated.capacity,
        },
      }
    },
    { maxWait: 5000, timeout: 10000 }
  )
}

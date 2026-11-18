import prisma from '../lib/prisma'

export interface RegistrationInput {
  name: string
  email: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Returns a list of validation problems; an empty list means the input is valid. */
export function validateRegistrationInput(body: unknown): string[] {
  const errors: string[] = []
  const input = (body ?? {}) as Record<string, unknown>
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

export type RegisterResult =
  | { kind: 'session_not_found' }
  | { kind: 'duplicate' }
  | { kind: 'full' }
  | {
      kind: 'confirmed'
      registration: {
        id: number
        sessionId: number
        name: string
        email: string
        createdAt: Date
      }
      session: { id: number; title: string; date: Date; registered: number; capacity: number }
    }

export async function registerForSession(
  sessionId: number,
  input: RegistrationInput
): Promise<RegisterResult> {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()

  return prisma.$transaction(async (tx) => {
    const session = await tx.trainingSession.findUnique({ where: { id: sessionId } })
    if (!session) return { kind: 'session_not_found' as const }

    const existing = await tx.registration.findFirst({ where: { sessionId, email } })
    if (existing) return { kind: 'duplicate' as const }

    // Claim a seat with a single conditional UPDATE so two concurrent requests can never
    // both take the last seat: the row only increments while registered < capacity.
    const claimed = await tx.trainingSession.updateMany({
      where: { id: sessionId, registered: { lt: session.capacity } },
      data: { registered: { increment: 1 } },
    })
    if (claimed.count === 0) return { kind: 'full' as const }

    const registration = await tx.registration.create({ data: { sessionId, name, email } })
    const updated = await tx.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })

    return {
      kind: 'confirmed' as const,
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
        date: updated.date,
        registered: updated.registered,
        capacity: updated.capacity,
      },
    }
  })
}

import prisma from '../lib/prisma'
import { notify } from '../notifications'

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
  } else if (input.name.trim().length > 100) {
    errors.push('name must be at most 100 characters')
  }
  if (typeof input.email !== 'string' || input.email.trim() === '') {
    errors.push('email is required')
  } else if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.push('email is invalid')
  }
  return errors
}

export const REGISTRATION_STATUS = {
  confirmed: 'confirmed',
  waitlisted: 'waitlisted',
  cancelled: 'cancelled',
} as const
export type RegistrationStatus = (typeof REGISTRATION_STATUS)[keyof typeof REGISTRATION_STATUS]

const ACTIVE_STATUSES: RegistrationStatus[] = ['confirmed', 'waitlisted']

export interface RegistrationDetails {
  id: number
  sessionId: number
  name: string
  email: string
  status: RegistrationStatus
  createdAt: Date
}

export interface SessionCounts {
  id: number
  title: string
  date: Date
  registered: number
  capacity: number
  waitlisted: number
}

export type RegisterResult =
  | { kind: 'session_not_found' }
  | { kind: 'deadline_passed' }
  | { kind: 'duplicate' }
  | { kind: 'confirmed'; registration: RegistrationDetails; session: SessionCounts }
  | {
      kind: 'waitlisted'
      registration: RegistrationDetails
      position: number
      session: SessionCounts
    }

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function sessionCounts(tx: Tx, sessionId: number): Promise<SessionCounts> {
  const s = await tx.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })
  const waitlisted = await tx.registration.count({ where: { sessionId, status: 'waitlisted' } })
  return {
    id: s.id,
    title: s.title,
    date: s.date,
    registered: s.registered,
    capacity: s.capacity,
    waitlisted,
  }
}

function details(r: {
  id: number
  sessionId: number
  name: string
  email: string
  status: string
  createdAt: Date
}): RegistrationDetails {
  return {
    id: r.id,
    sessionId: r.sessionId,
    name: r.name,
    email: r.email,
    status: r.status as RegistrationStatus,
    createdAt: r.createdAt,
  }
}

type TransitionReason = 'registered' | 'waitlisted' | 'promoted' | 'cancelled'

/** Writes one immutable audit entry; always called inside the transaction making the change. */
async function recordTransition(
  tx: Tx,
  registrationId: number,
  fromStatus: RegistrationStatus | null,
  toStatus: RegistrationStatus,
  reason: TransitionReason
) {
  await tx.auditLog.create({ data: { registrationId, fromStatus, toStatus, reason } })
}

/** 1-based position among waitlisted registrations of the session, ordered by id. */
async function waitlistPosition(tx: Tx, sessionId: number, registrationId: number) {
  return tx.registration.count({
    where: { sessionId, status: 'waitlisted', id: { lte: registrationId } },
  })
}

export async function registerForSession(
  sessionId: number,
  input: RegistrationInput,
  now: Date = new Date()
): Promise<RegisterResult> {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()

  const result = await prisma.$transaction(async (tx): Promise<RegisterResult> => {
    const session = await tx.trainingSession.findUnique({ where: { id: sessionId } })
    if (!session) return { kind: 'session_not_found' as const }

    // Server time is authoritative for the cut-off (LATC-7); applies to the waitlist too.
    if (session.registrationDeadline && now > session.registrationDeadline) {
      return { kind: 'deadline_passed' as const }
    }

    const existing = await tx.registration.findFirst({
      where: { sessionId, email, status: { in: ACTIVE_STATUSES } },
    })
    if (existing) return { kind: 'duplicate' as const }

    // Claim a seat with a single conditional UPDATE so two concurrent requests can never
    // both take the last seat: the row only increments while registered < capacity.
    const claimed = await tx.trainingSession.updateMany({
      where: { id: sessionId, registered: { lt: session.capacity } },
      data: { registered: { increment: 1 } },
    })

    if (claimed.count === 0) {
      const registration = await tx.registration.create({
        data: { sessionId, name, email, status: 'waitlisted' },
      })
      await recordTransition(tx, registration.id, null, 'waitlisted', 'waitlisted')
      return {
        kind: 'waitlisted' as const,
        registration: details(registration),
        position: await waitlistPosition(tx, sessionId, registration.id),
        session: await sessionCounts(tx, sessionId),
      }
    }

    const registration = await tx.registration.create({
      data: { sessionId, name, email, status: 'confirmed' },
    })
    await recordTransition(tx, registration.id, null, 'confirmed', 'registered')
    return {
      kind: 'confirmed' as const,
      registration: details(registration),
      session: await sessionCounts(tx, sessionId),
    }
  })

  // Only after the transaction committed (LATC-8); waitlisting is not notified.
  if (result.kind === 'confirmed') {
    notify({
      name: result.registration.name,
      email: result.registration.email,
      sessionTitle: result.session.title,
      sessionDate: result.session.date,
      status: 'confirmed',
    })
  }
  return result
}

/**
 * Flips the earliest waitlisted registration to confirmed. The conditional update means a
 * row already taken by a concurrent cancellation is skipped and the next candidate is tried.
 * Returns the promoted registration, or null when nobody is waiting.
 */
async function promoteFirstWaitlisted(
  tx: Tx,
  sessionId: number
): Promise<{ id: number; name: string; email: string } | null> {
  for (;;) {
    const candidate = await tx.registration.findFirst({
      where: { sessionId, status: 'waitlisted' },
      orderBy: { id: 'asc' },
    })
    if (!candidate) return null
    const promoted = await tx.registration.updateMany({
      where: { id: candidate.id, status: 'waitlisted' },
      data: { status: 'confirmed' },
    })
    if (promoted.count === 1) {
      await recordTransition(tx, candidate.id, 'waitlisted', 'confirmed', 'promoted')
      return candidate
    }
  }
}

export type CancelResult =
  | { kind: 'not_found' }
  | { kind: 'already_cancelled' }
  | {
      kind: 'cancelled'
      registration: RegistrationDetails
      promotedRegistrationId: number | null
      promoted: { id: number; name: string; email: string } | null
      session: SessionCounts
    }

export async function cancelRegistration(
  sessionId: number,
  registrationId: number
): Promise<CancelResult> {
  const result = await prisma.$transaction(async (tx): Promise<CancelResult> => {
    const current = await tx.registration.findFirst({ where: { id: registrationId, sessionId } })
    if (!current) return { kind: 'not_found' as const }

    // Conditional update: only the first of two concurrent cancels changes the row,
    // so the seat counter can never be decremented twice for one registration.
    const changed = await tx.registration.updateMany({
      where: { id: registrationId, sessionId, status: { not: 'cancelled' } },
      data: { status: 'cancelled' },
    })
    if (changed.count === 0) return { kind: 'already_cancelled' as const }
    await recordTransition(
      tx,
      registrationId,
      current.status as RegistrationStatus,
      'cancelled',
      'cancelled'
    )

    // A freed confirmed seat goes to the earliest waitlisted registration (LATC-5);
    // registered stays the same (-1 +1). Otherwise the seat is released.
    const promoted =
      current.status === 'confirmed' ? await promoteFirstWaitlisted(tx, sessionId) : null
    if (current.status === 'confirmed' && promoted === null) {
      await tx.trainingSession.update({
        where: { id: sessionId },
        data: { registered: { decrement: 1 } },
      })
    }

    const updated = await tx.registration.findUniqueOrThrow({ where: { id: registrationId } })
    return {
      kind: 'cancelled' as const,
      registration: details(updated),
      promotedRegistrationId: promoted?.id ?? null,
      promoted,
      session: await sessionCounts(tx, sessionId),
    }
  })

  if (result.kind === 'cancelled' && result.promoted) {
    notify({
      name: result.promoted.name,
      email: result.promoted.email,
      sessionTitle: result.session.title,
      sessionDate: result.session.date,
      status: 'promoted',
    })
  }
  return result
}

export async function getRegistration(sessionId: number, registrationId: number) {
  return prisma.$transaction(async (tx) => {
    const registration = await tx.registration.findFirst({
      where: { id: registrationId, sessionId },
    })
    if (!registration) return null
    const position =
      registration.status === 'waitlisted'
        ? await waitlistPosition(tx, sessionId, registration.id)
        : null
    return { ...details(registration), position }
  })
}

/** Organiser view: active registrations split by status, in registration order. */
export async function listRegistrations(sessionId: number) {
  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } })
  if (!session) return null
  const rows = await prisma.registration.findMany({
    where: { sessionId, status: { in: ACTIVE_STATUSES } },
    orderBy: { id: 'asc' },
  })
  const all = rows.map(details)
  return {
    confirmed: all.filter((r) => r.status === 'confirmed'),
    waitlisted: all.filter((r) => r.status === 'waitlisted'),
  }
}

/** Chronological audit history of one registration, or null when it does not exist. */
export async function getAuditHistory(sessionId: number, registrationId: number) {
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, sessionId },
  })
  if (!registration) return null
  return prisma.auditLog.findMany({
    where: { registrationId },
    orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      registrationId: true,
      fromStatus: true,
      toStatus: true,
      changedAt: true,
      reason: true,
    },
  })
}

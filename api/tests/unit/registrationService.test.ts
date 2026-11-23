import {
  REGISTRATION_STATUS,
  cancelRegistration,
  validateRegistrationInput,
} from '../../src/services/registrationService'

const tx = {
  registration: { findFirst: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
  trainingSession: { findUniqueOrThrow: jest.fn(), updateMany: jest.fn() },
}

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
  },
}))

afterEach(() => {
  jest.clearAllMocks()
})

describe('validateRegistrationInput', () => {
  it('returns no errors for valid input', () => {
    expect(validateRegistrationInput({ name: 'Ada', email: 'ada@example.com' })).toEqual([])
  })

  it('reports missing name and email', () => {
    expect(validateRegistrationInput({})).toEqual(['name is required', 'email is required'])
  })

  it('reports blank fields', () => {
    expect(validateRegistrationInput({ name: '   ', email: '  ' })).toEqual([
      'name is required',
      'email is required',
    ])
  })

  it('reports non-string fields as missing', () => {
    expect(validateRegistrationInput({ name: 42, email: 7 })).toEqual([
      'name is required',
      'email is required',
    ])
  })

  it('reports a malformed email', () => {
    expect(validateRegistrationInput({ name: 'Ada', email: 'not-an-email' })).toEqual([
      'email is invalid',
    ])
  })

  it('handles a null or undefined body', () => {
    expect(validateRegistrationInput(null)).toEqual(['name is required', 'email is required'])
    expect(validateRegistrationInput(undefined)).toEqual(['name is required', 'email is required'])
  })
})

describe('REGISTRATION_STATUS', () => {
  it('contains exactly confirmed, waitlisted and cancelled', () => {
    expect(Object.values(REGISTRATION_STATUS).sort()).toEqual([
      'cancelled',
      'confirmed',
      'waitlisted',
    ])
  })
})

describe('cancelRegistration', () => {
  const row = (status: string) => ({
    id: 1,
    sessionId: 10,
    name: 'Ada',
    email: 'ada@example.com',
    status,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  })

  beforeEach(() => {
    tx.trainingSession.findUniqueOrThrow.mockResolvedValue({
      id: 10,
      title: 'S',
      registered: 1,
      capacity: 1,
    })
    tx.registration.count.mockResolvedValue(0)
  })

  it('returns not_found and writes nothing when the registration is missing', async () => {
    tx.registration.findFirst.mockResolvedValue(null)

    expect(await cancelRegistration(10, 1)).toEqual({ kind: 'not_found' })
    expect(tx.registration.updateMany).not.toHaveBeenCalled()
  })

  it('returns already_cancelled and writes nothing for a cancelled registration', async () => {
    tx.registration.findFirst.mockResolvedValue(row('cancelled'))

    expect(await cancelRegistration(10, 1)).toEqual({ kind: 'already_cancelled' })
    expect(tx.registration.updateMany).not.toHaveBeenCalled()
    expect(tx.trainingSession.updateMany).not.toHaveBeenCalled()
  })

  it('cancels a waitlisted registration without touching the session', async () => {
    tx.registration.findFirst.mockResolvedValue(row('waitlisted'))
    tx.registration.updateMany.mockResolvedValue({ count: 1 })

    expect((await cancelRegistration(10, 1)).kind).toBe('cancelled')
    expect(tx.registration.updateMany).toHaveBeenCalledTimes(1)
    expect(tx.trainingSession.updateMany).not.toHaveBeenCalled()
  })

  it('releases one seat (never below 0) when cancelling a confirmed registration', async () => {
    tx.registration.findFirst.mockResolvedValue(row('confirmed'))
    tx.registration.updateMany.mockResolvedValue({ count: 1 })

    expect((await cancelRegistration(10, 1)).kind).toBe('cancelled')
    expect(tx.trainingSession.updateMany).toHaveBeenCalledWith({
      where: { id: 10, registered: { gt: 0 } },
      data: { registered: { decrement: 1 } },
    })
  })
})

import {
  REGISTRATION_STATUS,
  cancelRegistration,
  listRegistrations,
  validateRegistrationInput,
} from '../../src/services/registrationService'

const tx = {
  registration: { findFirst: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
  trainingSession: { findUniqueOrThrow: jest.fn(), updateMany: jest.fn() },
}

const mockFindSession = jest.fn()
const mockFindMany = jest.fn()

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    trainingSession: { findUnique: (...a: unknown[]) => mockFindSession(...a) },
    registration: { findMany: (...a: unknown[]) => mockFindMany(...a) },
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

  it('promotes the waitlist head and leaves registered unchanged', async () => {
    tx.registration.findFirst
      .mockResolvedValueOnce(row('confirmed'))
      .mockResolvedValueOnce({ ...row('waitlisted'), id: 2 })
    tx.registration.updateMany.mockResolvedValue({ count: 1 })

    const result = await cancelRegistration(10, 1)

    expect(result.kind === 'cancelled' && result.promoted?.id).toBe(2)
    expect(tx.registration.updateMany).toHaveBeenCalledTimes(2)
    expect(tx.trainingSession.updateMany).not.toHaveBeenCalled()
  })

  it('releases one seat (never below 0) when nobody is waiting', async () => {
    tx.registration.findFirst.mockResolvedValueOnce(row('confirmed')).mockResolvedValueOnce(null)
    tx.registration.updateMany.mockResolvedValue({ count: 1 })

    expect((await cancelRegistration(10, 1)).kind).toBe('cancelled')
    expect(tx.trainingSession.updateMany).toHaveBeenCalledWith({
      where: { id: 10, registered: { gt: 0 } },
      data: { registered: { decrement: 1 } },
    })
  })
})

describe('listRegistrations', () => {
  it('returns session_not_found without querying registrations', async () => {
    mockFindSession.mockResolvedValue(null)

    expect(await listRegistrations(1)).toEqual({ kind: 'session_not_found' })
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('groups rows into confirmed and waitlisted', async () => {
    const at = new Date('2026-01-01T00:00:00Z')
    mockFindSession.mockResolvedValue({ id: 1 })
    mockFindMany.mockResolvedValue([
      { id: 1, name: 'A', email: 'a@x.co', status: 'confirmed', createdAt: at },
      { id: 2, name: 'B', email: 'b@x.co', status: 'waitlisted', createdAt: at },
      { id: 3, name: 'C', email: 'c@x.co', status: 'confirmed', createdAt: at },
    ])

    const result = await listRegistrations(1)

    expect(result.kind).toBe('found')
    if (result.kind === 'found') {
      expect(result.roster.confirmed.map((r) => r.id)).toEqual([1, 3])
      expect(result.roster.waitlisted.map((r) => r.id)).toEqual([2])
    }
  })
})

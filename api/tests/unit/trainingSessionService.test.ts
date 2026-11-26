import * as trainingSessionService from '../../src/services/trainingSessionService'
import { getAllSessions, getSessionById } from '../../src/services/trainingSessionService'
import prisma from '../../src/lib/prisma'

// Accessed via the namespace so the suite compiles before the export exists;
// RED then fails at runtime on the expectations below.
type AdminService = { getAllSessionsForAdmin?: () => Promise<object[]> }
const getAllSessionsForAdmin = (): Promise<object[]> => {
  const fn = (trainingSessionService as unknown as AdminService).getAllSessionsForAdmin
  expect(typeof fn).toBe('function')
  return (fn as () => Promise<object[]>)()
}

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    trainingSession: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

const mockFindMany = prisma.trainingSession.findMany as jest.Mock
const mockFindUnique = prisma.trainingSession.findUnique as jest.Mock

const mockSession = {
  id: 1,
  title: 'TDD in Agentic Development Loop',
  description: 'Learn test-driven development with AI assistance.',
  date: new Date('2026-07-01T09:00:00Z'),
  capacity: 20,
  registered: 5,
  location: 'Room A',
  deliveryMode: 'In-person',
  status: 'open',
}

const include = {
  _count: { select: { registrations: { where: { status: 'waitlisted' } } } },
}
const withCount = <T extends object>(s: T, waitlisted = 0) => ({
  ...s,
  _count: { registrations: waitlisted },
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('getAllSessions', () => {
  it('returns sessions ordered by date with a flat waitlisted count', async () => {
    const second = { ...mockSession, id: 2, date: new Date('2026-07-02T09:00:00Z') }
    mockFindMany.mockResolvedValue([withCount(mockSession), withCount(second, 3)])

    const result = await getAllSessions()

    expect(result).toEqual([
      { ...mockSession, waitlisted: 0 },
      { ...second, waitlisted: 3 },
    ])
    expect(mockFindMany).toHaveBeenCalledWith({ orderBy: { date: 'asc' }, include })
  })

  it('returns an empty array when no sessions exist', async () => {
    mockFindMany.mockResolvedValue([])

    const result = await getAllSessions()

    expect(result).toEqual([])
  })
})

describe('getAllSessionsForAdmin', () => {
  it('queries sessions ordered by date ascending with no include', async () => {
    mockFindMany.mockResolvedValue([])

    await getAllSessionsForAdmin()

    expect(mockFindMany).toHaveBeenCalledTimes(1)
    expect(mockFindMany).toHaveBeenCalledWith({ orderBy: { date: 'asc' } })
  })

  it('returns the raw rows unchanged, without a waitlisted key', async () => {
    const second = { ...mockSession, id: 2, date: new Date('2026-07-02T09:00:00Z') }
    const rows = [mockSession, second]
    mockFindMany.mockResolvedValue(rows)

    const result: object[] = await getAllSessionsForAdmin()

    expect(result).toEqual([mockSession, second])
    result.forEach((row: object) => expect(row).not.toHaveProperty('waitlisted'))
  })

  it('propagates errors from prisma', async () => {
    mockFindMany.mockRejectedValue(new Error('db down'))

    await expect(getAllSessionsForAdmin()).rejects.toThrow('db down')
  })
})

describe('getSessionById', () => {
  it('returns the matching session', async () => {
    mockFindUnique.mockResolvedValue(withCount(mockSession, 2))

    const result = await getSessionById(1)

    expect(result).toEqual({ ...mockSession, waitlisted: 2 })
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 1 }, include })
  })

  it('returns null when session does not exist', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await getSessionById(999)

    expect(result).toBeNull()
  })
})

import { api } from './server'
import { getAllSessionsForAdmin } from '../../src/services/trainingSessionService'

jest.mock('../../src/services/trainingSessionService', () => {
  const actual = jest.requireActual<typeof import('../../src/services/trainingSessionService')>(
    '../../src/services/trainingSessionService'
  )
  return { ...actual, getAllSessionsForAdmin: jest.fn() }
})

const mockedGetAll = getAllSessionsForAdmin as jest.MockedFunction<typeof getAllSessionsForAdmin>

describe('GET /api/admin/sessions failure', () => {
  it('returns 500 with the error body when the service rejects', async () => {
    mockedGetAll.mockRejectedValueOnce(new Error('db down'))

    const res = await api().get('/api/admin/sessions')

    expect(mockedGetAll).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch sessions' })
  })

  it('returns 500 without leaking internals when the service throws synchronously', async () => {
    mockedGetAll.mockImplementationOnce(() => {
      throw new Error('secret connection string leaked')
    })

    const res = await api().get('/api/admin/sessions')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch sessions' })
    expect(JSON.stringify(res.body)).not.toContain('secret')
  })
})

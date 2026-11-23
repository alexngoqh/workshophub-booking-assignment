import { api } from './server'

describe('GET /health (LATC-1)', () => {
  it('returns 200 with status ok', async () => {
    const response = await api().get('/health')
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
  })

  it('includes a timestamp', async () => {
    const response = await api().get('/health')
    expect(response.body.timestamp).toBeDefined()
    expect(new Date(response.body.timestamp).toString()).not.toBe('Invalid Date')
  })
})

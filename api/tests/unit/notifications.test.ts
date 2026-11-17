import http from 'http'
import { AddressInfo } from 'net'
import {
  consoleTransport,
  flushNotifications,
  notify,
  RegistrationNotification,
  setTransportsForTesting,
  slackTransport,
} from '../../src/notifications'

const event: RegistrationNotification = {
  name: 'Ada',
  email: 'ada@example.com',
  sessionTitle: 'TDD in Agentic Development Loop',
  sessionDate: new Date('2026-07-22T09:00:00Z'),
  status: 'confirmed',
}

afterEach(() => {
  setTransportsForTesting(null)
  jest.restoreAllMocks()
  delete process.env.SLACK_WEBHOOK_URL
})

describe('notifications (LATC-8)', () => {
  it('console transport logs status, name, email, session title and date', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {})
    await consoleTransport(event)
    expect(info).toHaveBeenCalledWith(
      '[notification] confirmed: Ada <ada@example.com> is confirmed for ' +
        '"TDD in Agentic Development Loop" on 2026-07-22T09:00:00.000Z'
    )
  })

  it('describes promotions explicitly', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {})
    await consoleTransport({ ...event, status: 'promoted' })
    expect(info.mock.calls[0][0]).toContain('promoted from the waitlist and confirmed')
  })

  it('notify returns immediately and delivers asynchronously', async () => {
    const delivered: RegistrationNotification[] = []
    setTransportsForTesting([async (e) => void delivered.push(e)])

    const returned = notify(event)

    expect(returned).toBeUndefined()
    expect(delivered).toHaveLength(0) // not delivered synchronously
    await flushNotifications()
    expect(delivered).toEqual([event])
  })

  it('swallows and logs transport failures', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const ok: RegistrationNotification[] = []
    setTransportsForTesting([
      async () => {
        throw new Error('boom')
      },
      async (e) => void ok.push(e),
    ])

    expect(() => notify(event)).not.toThrow()
    await flushNotifications()

    expect(error).toHaveBeenCalledWith('[notification] delivery failed:', expect.any(Error))
    expect(ok).toHaveLength(1) // other transports still deliver
  })

  it('posts a JSON text message to the Slack webhook', async () => {
    const received: { method?: string; body: string; type?: string }[] = []
    const server = http.createServer((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        received.push({ method: req.method, body, type: req.headers['content-type'] })
        res.end('ok')
      })
    })
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const { port } = server.address() as AddressInfo

    try {
      await slackTransport(`http://127.0.0.1:${port}/hook`)(event)
    } finally {
      server.close()
    }

    expect(received).toHaveLength(1)
    expect(received[0].method).toBe('POST')
    expect(received[0].type).toBe('application/json')
    expect(JSON.parse(received[0].body).text).toContain('Ada <ada@example.com> is confirmed')
  })

  it('uses Slack only when SLACK_WEBHOOK_URL is set', async () => {
    jest.spyOn(console, 'info').mockImplementation(() => {})
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }))

    notify(event)
    await flushNotifications()
    expect(fetchSpy).not.toHaveBeenCalled()

    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/abc'
    notify(event)
    await flushNotifications()
    expect(fetchSpy).toHaveBeenCalledWith('https://hooks.slack.test/abc', expect.any(Object))
  })
})

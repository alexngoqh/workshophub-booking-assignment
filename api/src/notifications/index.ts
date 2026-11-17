// Fire-and-forget notifications for registration outcomes (LATC-8).
// `notify` never throws and never makes the caller wait: delivery happens asynchronously and
// failures are logged and swallowed, so a broken transport cannot fail a registration.

export interface RegistrationNotification {
  name: string
  email: string
  sessionTitle: string
  sessionDate: Date
  status: 'confirmed' | 'promoted'
}

export type Transport = (event: RegistrationNotification) => Promise<void>

export function formatMessage(event: RegistrationNotification): string {
  const verb =
    event.status === 'promoted' ? 'promoted from the waitlist and confirmed' : 'confirmed'
  return (
    `${event.name} <${event.email}> is ${verb} for "${event.sessionTitle}" ` +
    `on ${event.sessionDate.toISOString()}`
  )
}

export const consoleTransport: Transport = async (event) => {
  console.info(`[notification] ${event.status}: ${formatMessage(event)}`)
}

export function slackTransport(webhookUrl: string): Transport {
  return async (event) => {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `:white_check_mark: ${formatMessage(event)}` }),
    })
    if (!res.ok) throw new Error(`Slack webhook responded ${res.status}`)
  }
}

function defaultTransports(): Transport[] {
  const transports = [consoleTransport]
  const webhook = process.env.SLACK_WEBHOOK_URL
  if (webhook) transports.push(slackTransport(webhook))
  return transports
}

let transportOverride: Transport[] | null = null
const pending = new Set<Promise<void>>()

export function notify(event: RegistrationNotification): void {
  const transports = transportOverride ?? defaultTransports()
  for (const transport of transports) {
    const delivery = Promise.resolve()
      .then(() => transport(event))
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error)
        console.error(`[notification] delivery failed: ${reason}`)
      })
      .finally(() => pending.delete(delivery))
    pending.add(delivery)
  }
}

/** Test hook: replace the transports (null restores the defaults). */
export function setTransportsForTesting(transports: Transport[] | null) {
  transportOverride = transports
}

/** Test hook: wait for all in-flight deliveries. */
export async function flushNotifications() {
  while (pending.size > 0) await Promise.all([...pending])
}

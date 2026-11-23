export const API_BASE = import.meta.env.VITE_API_URL || ''

export interface ApiError {
  error: string
  details?: string[]
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string }

async function send<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = json as ApiError
      const message = err.details?.length ? err.details.join(', ') : err.error
      return { ok: false, status: res.status, error: message || `Server error: ${res.status}` }
    }
    return { ok: true, status: res.status, data: json as T }
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server. Please try again.' }
  }
}

export type RegistrationStatus = 'confirmed' | 'waitlisted' | 'cancelled'

export interface SessionCounts {
  id: number
  title: string
  date: string
  registered: number
  capacity: number
  waitlisted: number
}

export interface RegistrationResponse {
  id: number
  sessionId: number
  name: string
  email: string
  status: RegistrationStatus
  /** Present when status is "waitlisted" (1-based). */
  position?: number
  createdAt: string
  session: SessionCounts
}

export function registerForSession(sessionId: number, input: { name: string; email: string }) {
  return send<RegistrationResponse>(
    'POST',
    `/api/training-sessions/${sessionId}/registrations`,
    input
  )
}

export interface RegistrationLookup {
  id: number
  sessionId: number
  name: string
  email: string
  status: RegistrationStatus
  position: number | null
  createdAt: string
}

export type CancelResponse = Omit<RegistrationResponse, 'position'>

export function getRegistration(sessionId: number, registrationId: number) {
  return send<RegistrationLookup>(
    'GET',
    `/api/training-sessions/${sessionId}/registrations/${registrationId}`
  )
}

export function cancelRegistration(sessionId: number, registrationId: number) {
  return send<CancelResponse>(
    'DELETE',
    `/api/training-sessions/${sessionId}/registrations/${registrationId}`
  )
}

export interface SessionRegistrations {
  confirmed: RegistrationLookup[]
  waitlisted: RegistrationLookup[]
}

export function listRegistrations(sessionId: number) {
  return send<SessionRegistrations>('GET', `/api/training-sessions/${sessionId}/registrations`)
}

export function getSession<T>(sessionId: number) {
  return send<T>('GET', `/api/training-sessions/${sessionId}`)
}

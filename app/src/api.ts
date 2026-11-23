import type {
  CancelResponse,
  RegistrationRoster,
  TrainingSession,
  RegistrationInput,
  RegistrationResponse,
  RegistrationStatusView,
} from './types'

const API_BASE = import.meta.env.VITE_API_URL || ''

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

interface ErrorBody {
  error?: string
  details?: string[]
}

async function request<T>(url: string, init: RequestInit, fallback: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, init)

    if (res.ok) {
      const data = (await res.json()) as T
      return { ok: true, data }
    }

    const body = (await res.json().catch(() => ({}))) as ErrorBody
    return {
      ok: false,
      status: res.status,
      error: body.details?.join(', ') || body.error || fallback,
    }
  } catch {
    return { ok: false, status: 0, error: 'Network error' }
  }
}

const registrationsUrl = (sessionId: number) =>
  `${API_BASE}/api/training-sessions/${sessionId}/registrations`

export function registerForSession(
  sessionId: number,
  input: RegistrationInput
): Promise<ApiResult<RegistrationResponse>> {
  return request(
    registrationsUrl(sessionId),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Registration failed'
  )
}

export function cancelRegistration(
  sessionId: number,
  registrationId: number
): Promise<ApiResult<CancelResponse>> {
  return request(
    `${registrationsUrl(sessionId)}/${registrationId}`,
    { method: 'DELETE' },
    'Cancellation failed'
  )
}

export function getRegistration(
  sessionId: number,
  registrationId: number
): Promise<ApiResult<RegistrationStatusView>> {
  return request(
    `${registrationsUrl(sessionId)}/${registrationId}`,
    { method: 'GET' },
    'Could not load registration'
  )
}

export function getSession(sessionId: number): Promise<ApiResult<TrainingSession>> {
  return request(
    `${API_BASE}/api/training-sessions/${sessionId}`,
    { method: 'GET' },
    'Could not load session'
  )
}

export function listRegistrations(sessionId: number): Promise<ApiResult<RegistrationRoster>> {
  return request(registrationsUrl(sessionId), { method: 'GET' }, 'Could not load registrations')
}

import type { RegistrationInput, RegistrationResponse } from './types'

const API_BASE = import.meta.env.VITE_API_URL || ''

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

interface ErrorBody {
  error?: string
  details?: string[]
}

export async function registerForSession(
  sessionId: number,
  input: RegistrationInput
): Promise<ApiResult<RegistrationResponse>> {
  try {
    const res = await fetch(`${API_BASE}/api/training-sessions/${sessionId}/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    if (res.ok) {
      const data = (await res.json()) as RegistrationResponse
      return { ok: true, data }
    }

    const body = (await res.json().catch(() => ({}))) as ErrorBody
    return {
      ok: false,
      status: res.status,
      error: body.details?.join(', ') || body.error || 'Registration failed',
    }
  } catch {
    return { ok: false, status: 0, error: 'Network error' }
  }
}

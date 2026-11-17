// Remembers which registration this browser made for each session. There is no login, so the
// registration id acts as the identity token (see LATC-4). Storage can be unavailable (private
// mode, blocked site data), so every access is guarded and failures simply forget.
const KEY = 'workshophub.myRegistrations'

type Store = Record<string, { registrationId: number }>

function read(): Store {
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {}
  } catch {
    return {}
  }
}

function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // ignore: the registration still exists on the server
  }
}

export function getMyRegistrationId(sessionId: number): number | null {
  return read()[String(sessionId)]?.registrationId ?? null
}

export function rememberMyRegistration(sessionId: number, registrationId: number) {
  write({ ...read(), [String(sessionId)]: { registrationId } })
}

export function forgetMyRegistration(sessionId: number) {
  const store = read()
  delete store[String(sessionId)]
  write(store)
}

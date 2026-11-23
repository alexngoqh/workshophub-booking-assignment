// Tiny publish/subscribe channel so any component can raise an app-level banner (LATC-8).
export interface BannerMessage {
  id: number
  text: string
}

type Listener = (message: BannerMessage) => void

const listeners = new Set<Listener>()
let nextId = 1

export function showBanner(text: string) {
  const message = { id: nextId++, text }
  listeners.forEach((listener) => listener(message))
}

export function subscribeToBanners(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

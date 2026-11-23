import { MouseEvent, useEffect, useState } from 'react'

// Minimal client-side router for the two pages of the app ("/" and "/sessions/:id").
const NAVIGATE_EVENT = 'workshophub:navigate'

export function navigate(to: string) {
  if (to === window.location.pathname) return
  window.history.pushState({}, '', to)
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
  window.scrollTo(0, 0)
}

export function usePath(): string {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const update = () => setPath(window.location.pathname)
    window.addEventListener('popstate', update)
    window.addEventListener(NAVIGATE_EVENT, update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener(NAVIGATE_EVENT, update)
    }
  }, [])
  return path
}

/** Click handler for <a href> that navigates in-app but keeps ctrl/cmd/middle-click working. */
export function linkHandler(to: string) {
  return (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }
}

export function sessionPath(id: number) {
  return `/sessions/${id}`
}

/** Returns the session id for "/sessions/:id", or null for any other path. */
export function matchSessionPath(path: string): number | null {
  const match = /^\/sessions\/(\d+)\/?$/.exec(path)
  return match ? Number(match[1]) : null
}

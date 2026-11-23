import { createElement, useEffect, useState, type MouseEvent, type ReactNode } from 'react'

// Minimal client-side router for two pages ("/" and "/sessions/:id"); no library needed.
const NAVIGATE_EVENT = 'workshophub:navigate'

export function navigate(to: string): void {
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

interface LinkProps {
  to: string
  className?: string
  children: ReactNode
}

// A real <a href> so new tabs and deep links work; plain left clicks stay in the SPA.
export function Link({ to, className, children }: LinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    event.preventDefault()
    navigate(to)
  }
  return createElement('a', { href: to, className, onClick: handleClick }, children)
}

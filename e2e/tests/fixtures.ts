import { test as base, expect, BrowserContext, Page } from '@playwright/test'

// When SHOW_CURSOR=1 (set by the local verify scripts), inject a visible cursor that follows
// the mouse, ripples on click, and outlines the focused field, so a headed run is easy to follow.
export const cursorScript = () => {
  const install = () => {
    if (document.getElementById('__pw_cursor')) return
    const style = document.createElement('style')
    style.textContent = `
      #__pw_cursor { position: fixed; z-index: 2147483647; pointer-events: none;
        width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%;
        background: rgba(239, 68, 68, 0.35); border: 2px solid #ef4444;
        transition: left 0.12s ease, top 0.12s ease, transform 0.12s ease; left: -50px; top: -50px; }
      #__pw_cursor.__down { transform: scale(0.6); background: rgba(239, 68, 68, 0.7); }
      .__pw_ripple { position: fixed; z-index: 2147483646; pointer-events: none; width: 16px;
        height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; border: 3px solid #ef4444;
        animation: __pw_ripple 0.6s ease-out forwards; }
      @keyframes __pw_ripple { to { transform: scale(4); opacity: 0; } }
      input:focus, textarea:focus, select:focus, button:focus-visible {
        outline: 3px solid #f97316 !important; outline-offset: 2px; }
    `
    document.head.appendChild(style)
    const dot = document.createElement('div')
    dot.id = '__pw_cursor'
    document.body.appendChild(dot)
    document.addEventListener(
      'mousemove',
      (e) => {
        dot.style.left = `${e.clientX}px`
        dot.style.top = `${e.clientY}px`
      },
      true
    )
    document.addEventListener(
      'mousedown',
      (e) => {
        dot.classList.add('__down')
        const ripple = document.createElement('div')
        ripple.className = '__pw_ripple'
        ripple.style.left = `${e.clientX}px`
        ripple.style.top = `${e.clientY}px`
        document.body.appendChild(ripple)
        setTimeout(() => ripple.remove(), 700)
      },
      true
    )
    document.addEventListener('mouseup', () => dot.classList.remove('__down'), true)
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install)
  } else {
    install()
  }
}

export const test = base.extend<{ newUserPage: () => Promise<Page> }>({
  page: async ({ page }, use) => {
    if (process.env.SHOW_CURSOR) await page.addInitScript(cursorScript)
    await use(page)
  },
  // A page in a fresh browser context = a second employee with their own localStorage.
  newUserPage: async ({ browser }, use) => {
    const contexts: BrowserContext[] = []
    await use(async () => {
      const context = await browser.newContext({ baseURL: test.info().project.use.baseURL })
      contexts.push(context)
      if (process.env.SHOW_CURSOR) await context.addInitScript(cursorScript)
      return context.newPage()
    })
    await Promise.all(contexts.map((c) => c.close()))
  },
})

export { expect }
export type { Page } from '@playwright/test'

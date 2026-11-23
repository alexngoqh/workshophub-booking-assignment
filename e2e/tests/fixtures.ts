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

// Demo mode (verify scripts): a ticket summary panel (top-right) and the current scenario
// (bottom-left). Rendered in a closed shadow root so tests can never match this text.
const demoOverlayScript = (args: { scenario: string; story: string }) => {
  const install = () => {
    if (document.getElementById('__pw_demo')) return
    const host = document.createElement('div')
    host.id = '__pw_demo'
    const root = host.attachShadow({ mode: 'closed' })
    const story = args.story
      ? (JSON.parse(args.story) as { title: string; summary: string[] })
      : null
    const style = document.createElement('style')
    style.textContent = `
      .panel, .caption { position: fixed; z-index: 2147483647; pointer-events: none;
        font: 14px/1.4 system-ui, sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,.3);
        border-radius: 10px; }
      .panel { top: 12px; right: 12px; width: 360px; padding: 12px 14px;
        background: rgba(255,255,255,.97); color: #111827; border: 2px solid #2563eb; }
      .panel h4 { margin: 0 0 6px; font-size: 14px; color: #1d4ed8; }
      .panel ul { margin: 0; padding-left: 18px; }
      .panel li { margin: 2px 0; }
      .caption { left: 12px; bottom: 12px; max-width: 70vw; padding: 10px 14px;
        background: rgba(17,24,39,.9); color: #fff; font-weight: 600; font-size: 15px; }
      .status { margin-top: 4px; color: #fbbf24; font-weight: 500; font-size: 14px; }
      .status:empty { display: none; }`
    root.appendChild(style)
    if (story) {
      const panel = document.createElement('div')
      panel.className = 'panel'
      const h = document.createElement('h4')
      h.textContent = `Ticket: ${story.title}`
      const ul = document.createElement('ul')
      for (const line of story.summary) {
        const li = document.createElement('li')
        li.textContent = line
        ul.appendChild(li)
      }
      panel.append(h, ul)
      root.appendChild(panel)
    }
    const caption = document.createElement('div')
    caption.className = 'caption'
    const scenario = document.createElement('div')
    scenario.textContent = `▶ Scenario: ${args.scenario}`
    const status = document.createElement('div')
    status.className = 'status'
    caption.append(scenario, status)
    root.appendChild(caption)
    Object.defineProperty(window, '__pwDemoStatus', {
      configurable: true,
      value: (text: string) => {
        status.textContent = text
      },
    })
    document.body.appendChild(host)
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install)
  } else {
    install()
  }
}

// Demo mode: pause after each user-visible action so a human can follow along.
// CLICK_PAUSE applies to clicks and page loads, FILL_PAUSE to typing into fields.
let actionPausesInstalled = false

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function showStatus(page: Page, text: string) {
  await page
    .evaluate(
      (t) => (window as unknown as { __pwDemoStatus?: (x: string) => void }).__pwDemoStatus?.(t),
      text
    )
    .catch(() => {})
}

async function countdown(page: Page, label: string, ms: number) {
  for (let left = Math.ceil(ms / 1000); left > 0; left--) {
    await showStatus(page, `⏸ ${label} sau ${left}s…`)
    await sleep(Math.min(1000, ms))
  }
  await showStatus(page, '')
}

function installActionPauses(page: Page) {
  if (actionPausesInstalled) return
  actionPausesInstalled = true
  const clickPause = Number(process.env.CLICK_PAUSE ?? 0)
  const fillPause = Number(process.env.FILL_PAUSE ?? 0)

  type Fn = (...args: unknown[]) => Promise<unknown>
  // `before`: hold the current screen (the result of the previous step) and announce the
  // next action. Waiting *after* a click would let short-lived UI (e.g. auto-dismissing
  // banners) disappear before the test checks it.
  const wrap = (
    proto: Record<string, unknown>,
    method: string,
    ms: number,
    label: string,
    pageOf: (self: unknown) => Page,
    when: 'before' | 'after'
  ) => {
    const original = proto[method] as Fn
    if (!original || ms <= 0) return
    proto[method] = async function (this: unknown, ...args: unknown[]) {
      const p = pageOf(this)
      // Never wait before acting on the auto-dismissing banner (LATC-8): it would be gone.
      const onBanner = String(this).includes('.banner')
      if (when === 'before' && !onBanner && !p.isClosed()) await countdown(p, label, ms)
      const result = await original.apply(this, args)
      if (when === 'after' && !p.isClosed()) await countdown(p, label, ms)
      return result
    }
  }

  const locatorProto = Object.getPrototypeOf(page.locator('body'))
  const locatorPage = (self: unknown) => (self as { page(): Page }).page()
  wrap(locatorProto, 'click', clickPause, 'Sắp click', locatorPage, 'before')
  wrap(locatorProto, 'check', clickPause, 'Sắp chọn', locatorPage, 'before')
  wrap(locatorProto, 'fill', fillPause, 'Sắp nhập', locatorPage, 'before')

  const pageProto = Object.getPrototypeOf(page)
  const self = (p: unknown) => p as Page
  wrap(pageProto, 'goto', clickPause, 'Đã mở trang', self, 'after')
  wrap(pageProto, 'reload', clickPause, 'Đã tải lại trang', self, 'after')
  wrap(pageProto, 'goBack', clickPause, 'Đã quay lại', self, 'after')
}

function scenarioTitle() {
  const info = test.info()
  return info.title
}

export const test = base.extend<{ newUserPage: () => Promise<Page> }>({
  page: async ({ page }, use) => {
    if (process.env.SHOW_CURSOR) {
      await page.addInitScript(cursorScript)
      await page.addInitScript(demoOverlayScript, {
        scenario: scenarioTitle(),
        story: process.env.DEMO_STORY ?? '',
      })
      installActionPauses(page)
    }
    await use(page)
    const hold = Number(process.env.DEMO_PAUSE ?? 0)
    if (hold > 0 && !page.isClosed()) await page.waitForTimeout(hold)
  },
  // A page in a fresh browser context = a second employee with their own localStorage.
  newUserPage: async ({ browser }, use) => {
    const contexts: BrowserContext[] = []
    await use(async () => {
      const context = await browser.newContext({ baseURL: test.info().project.use.baseURL })
      contexts.push(context)
      if (process.env.SHOW_CURSOR) {
        await context.addInitScript(cursorScript)
        await context.addInitScript(demoOverlayScript, {
          scenario: `${scenarioTitle()} (second employee's browser)`,
          story: process.env.DEMO_STORY ?? '',
        })
      }
      return context.newPage()
    })
    await Promise.all(contexts.map((c) => c.close()))
  },
})

export { expect }
export type { Page } from '@playwright/test'

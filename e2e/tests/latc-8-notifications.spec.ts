import { test, expect, Page } from './fixtures'
import { fillSession, resetDatabase } from './helpers'

const TITLE = 'Secure Coding with AI Assistance' // capacity 16, no deadline

test.beforeEach(() => resetDatabase())

const card = (page: Page) => page.locator('.session-card').filter({ hasText: TITLE })
const banner = (page: Page) => page.locator('.banner')

async function submit(page: Page, name: string, email: string, full = false) {
  const c = card(page)
  await c.getByRole('button', { name: full ? 'Join Waitlist' : 'Register' }).click()
  await c.getByLabel('Name').fill(name)
  await c.getByLabel('Email').fill(email)
  await c.getByRole('button', { name: full ? 'Join waitlist' : 'Confirm registration' }).click()
}

test.describe('LATC-8: notification after registration or waitlist promotion', () => {
  test('shows the registered banner with session title and date, without reload', async ({
    page,
  }) => {
    await page.goto('/')
    let reloaded = false
    page.on('framenavigated', () => (reloaded = true))
    await submit(page, 'Ada', 'ada@example.com')

    await expect(banner(page)).toHaveText(
      /^You're registered! Secure Coding with AI Assistance on \w+day, \d{1,2} \w+ \d{4}×$/
    )
    await expect(banner(page)).toContainText('Wednesday, 29 July 2026')
    expect(reloaded).toBe(false)
  })

  test('shows the waitlist banner when the session is full', async ({ page, request }) => {
    await fillSession(request, TITLE)
    await page.goto('/')
    await submit(page, 'Grace', 'grace@example.com', true)

    await expect(banner(page)).toContainText(
      `You're on the waitlist for ${TITLE}. We'll let you know if a spot opens up.`
    )
  })

  test('the banner can be dismissed', async ({ page }) => {
    await page.goto('/')
    await submit(page, 'Ada', 'ada@example.com')
    await expect(banner(page)).toBeVisible()

    await banner(page).getByRole('button', { name: 'Dismiss' }).click()
    await expect(banner(page)).toHaveCount(0)
  })

  test('the banner auto-dismisses after a few seconds', async ({ page }) => {
    await page.clock.install()
    await page.goto('/')
    await submit(page, 'Ada', 'ada@example.com')
    await expect(banner(page)).toBeVisible()

    await page.clock.runFor(5000)
    await expect(banner(page)).toBeVisible()
    await page.clock.runFor(1500)
    await expect(banner(page)).toHaveCount(0)
  })

  test('a failed backend notification does not affect the banner or registration', async ({
    page,
  }) => {
    // playwright.config.ts points SLACK_WEBHOOK_URL at an unreachable address, so the Slack
    // delivery for this registration really fails on the server.
    await page.goto('/')
    await submit(page, 'Ada', 'ada@example.com')
    await expect(banner(page)).toContainText("You're registered!")
    await expect(card(page).getByText('1 / 16 registered')).toBeVisible()
  })
})

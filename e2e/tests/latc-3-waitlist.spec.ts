import { test, expect, Page } from './fixtures'
import { fillSession, findSession, registerViaApi, resetDatabase } from './helpers'

const TITLE = 'Secure Coding with AI Assistance' // capacity 16

test.beforeEach(() => resetDatabase())

const card = (page: Page) => page.locator('.session-card').filter({ hasText: TITLE })

async function joinWaitlist(page: Page, name: string, email: string) {
  const c = card(page)
  await c.getByRole('button', { name: 'Join Waitlist' }).click()
  await c.getByLabel('Name').fill(name)
  await c.getByLabel('Email').fill(email)
  await c.getByRole('button', { name: 'Join waitlist' }).click()
}

test.describe('LATC-3: waitlist when a session is full', () => {
  test('a full session offers Join Waitlist instead of Register', async ({ page, request }) => {
    await fillSession(request, TITLE)
    await page.goto('/')
    const c = card(page)
    await expect(c.getByText('16 / 16 registered')).toBeVisible()
    await expect(c.getByText('Full', { exact: true })).toBeVisible()
    await expect(c.getByRole('button', { name: 'Join Waitlist' })).toBeEnabled()
    await expect(c.getByRole('button', { name: 'Register' })).toHaveCount(0)
  })

  test('joining shows a waitlisted (not confirmed) message and the waitlist count', async ({
    page,
    request,
  }) => {
    await fillSession(request, TITLE)
    await page.goto('/')
    await joinWaitlist(page, 'Grace Hopper', 'grace@example.com')

    const c = card(page)
    await expect(c.getByRole('status')).toHaveText(
      "You're on the waitlist (position 1). Your place is not confirmed yet."
    )
    await expect(c.getByText('16 / 16 registered')).toBeVisible()
    await expect(c.getByText('1 on waitlist')).toBeVisible()

    const session = await findSession(request, TITLE)
    expect(session.registered).toBe(16)
    expect(session.waitlisted).toBe(1)
  })

  test('the second person gets position 2', async ({ page, request }) => {
    const session = await fillSession(request, TITLE)
    await registerViaApi(request, session.id, 'First', 'first@example.com')

    await page.goto('/')
    await expect(card(page).getByText('1 on waitlist')).toBeVisible()
    await joinWaitlist(page, 'Second', 'second@example.com')

    await expect(card(page).getByRole('status')).toContainText('position 2')
    await expect(card(page).getByText('2 on waitlist')).toBeVisible()
  })

  test('a session with free seats still confirms instead of waitlisting', async ({ page }) => {
    await page.goto('/')
    const c = card(page)
    await c.getByRole('button', { name: 'Register' }).click()
    await c.getByLabel('Name').fill('Ada')
    await c.getByLabel('Email').fill('ada@example.com')
    await c.getByRole('button', { name: 'Confirm registration' }).click()
    await expect(c.getByRole('status')).toContainText('Registration confirmed')
    await expect(c.getByText('on waitlist')).toHaveCount(0)
  })
})

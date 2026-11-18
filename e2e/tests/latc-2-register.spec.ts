import { test, expect } from './fixtures'
import { API_URL, findSession, resetDatabase } from './helpers'

const TITLE = 'Secure Coding with AI Assistance' // capacity 16

test.beforeEach(() => resetDatabase())

function card(page: import('./fixtures').Page, title = TITLE) {
  return page.locator('.session-card').filter({ hasText: title })
}

test.describe('LATC-2: register for a training session', () => {
  test('registers with name and email, shows confirmation and updates the count', async ({
    page,
    request,
  }) => {
    await page.goto('/')
    const c = card(page)
    await expect(c.getByText('0 / 16 registered')).toBeVisible()

    await c.getByRole('button', { name: 'Register' }).click()
    await c.getByLabel('Name').fill('Ada Lovelace')
    await c.getByLabel('Email').fill('ada@example.com')
    await c.getByRole('button', { name: 'Confirm registration' }).click()

    await expect(page.locator('.banner')).toContainText(`You're registered! ${TITLE} on`)
    await expect(c.getByText('Your status: Confirmed')).toBeVisible()
    await expect(c.getByText('1 / 16 registered')).toBeVisible()

    // Persisted on the server, not just in the UI
    const session = await findSession(request, TITLE)
    expect(session.registered).toBe(1)
    await page.reload()
    await expect(card(page).getByText('1 / 16 registered')).toBeVisible()
  })

  test('shows validation errors from the server for an empty form', async ({ page }) => {
    await page.goto('/')
    const c = card(page)
    await c.getByRole('button', { name: 'Register' }).click()
    await c.getByRole('button', { name: 'Confirm registration' }).click()

    await expect(c.getByRole('alert')).toHaveText('name is required, email is required')
    await expect(c.getByText('0 / 16 registered')).toBeVisible()
  })

  test('shows the duplicate-registration error and does not double count', async ({
    page,
    request,
  }) => {
    const session = await findSession(request, TITLE)
    await request.post(`${API_URL}/api/training-sessions/${session.id}/registrations`, {
      data: { name: 'Ada', email: 'ada@example.com' },
    })

    await page.goto('/')
    const c = card(page)
    await c.getByRole('button', { name: 'Register' }).click()
    await c.getByLabel('Name').fill('Ada again')
    await c.getByLabel('Email').fill('ADA@example.com')
    await c.getByRole('button', { name: 'Confirm registration' }).click()

    await expect(c.getByRole('alert')).toContainText('already registered')
    await expect(c.getByText('1 / 16 registered')).toBeVisible()
  })

  test('Back closes the form without registering', async ({ page }) => {
    await page.goto('/')
    const c = card(page)
    await c.getByRole('button', { name: 'Register' }).click()
    await c.getByRole('button', { name: 'Back' }).click()
    await expect(c.getByRole('button', { name: 'Register' })).toBeVisible()
    await expect(c.getByText('0 / 16 registered')).toBeVisible()
  })
})

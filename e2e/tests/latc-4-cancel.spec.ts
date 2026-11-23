import { test, expect, Page } from './fixtures'
import { API_URL, fillSession, findSession, resetDatabase } from './helpers'

const TITLE = 'Secure Coding with AI Assistance' // capacity 16

test.beforeEach(() => resetDatabase())

const card = (page: Page) => page.locator('.session-card').filter({ hasText: TITLE })

async function registerInUi(page: Page, name: string, email: string, full = false) {
  const c = card(page)
  await c.getByRole('button', { name: full ? 'Join Waitlist' : 'Register' }).click()
  await c.getByLabel('Name').fill(name)
  await c.getByLabel('Email').fill(email)
  await c.getByRole('button', { name: full ? 'Join waitlist' : 'Confirm registration' }).click()
  await expect(c.getByRole('button', { name: 'Cancel Registration' })).toBeVisible()
}

test.describe('LATC-4: cancel registration', () => {
  test('cancels after confirming the prompt and updates the card', async ({ page, request }) => {
    await page.goto('/')
    await registerInUi(page, 'Ada', 'ada@example.com')
    const c = card(page)
    await expect(c.getByText('Your status: Confirmed')).toBeVisible()
    await expect(c.getByText('1 / 16 registered (15 spots left)')).toBeVisible()

    let prompt = ''
    page.once('dialog', (dialog) => {
      prompt = dialog.message()
      dialog.accept()
    })
    await c.getByRole('button', { name: 'Cancel Registration' }).click()

    await expect(c.getByRole('status')).toHaveText('Your registration has been cancelled')
    expect(prompt).toBe(`Are you sure you want to cancel your registration for ${TITLE}?`)
    await expect(c.getByText('0 / 16 registered (16 spots left)')).toBeVisible()
    await expect(c.getByRole('button', { name: 'Cancelled' })).toBeDisabled()
    await expect(c.getByRole('button', { name: 'Cancel Registration' })).toHaveCount(0)

    const session = await findSession(request, TITLE)
    expect(session.registered).toBe(0)
  })

  test('dismissing the prompt keeps the registration', async ({ page, request }) => {
    await page.goto('/')
    await registerInUi(page, 'Ada', 'ada@example.com')
    const c = card(page)

    page.once('dialog', (dialog) => dialog.dismiss())
    await c.getByRole('button', { name: 'Cancel Registration' }).click()

    await expect(c.getByRole('button', { name: 'Cancel Registration' })).toBeVisible()
    await expect(c.getByText('1 / 16 registered')).toBeVisible()
    expect((await findSession(request, TITLE)).registered).toBe(1)
  })

  test('my status and the cancel button survive a reload', async ({ page }) => {
    await page.goto('/')
    await registerInUi(page, 'Ada', 'ada@example.com')
    await page.reload()

    const c = card(page)
    await expect(c.getByText('Your status: Confirmed')).toBeVisible()
    await expect(c.getByRole('button', { name: 'Cancel Registration' })).toBeVisible()
  })

  test('a cancelled registration shows a disabled Cancelled button after reload', async ({
    page,
  }) => {
    await page.goto('/')
    await registerInUi(page, 'Ada', 'ada@example.com')
    page.once('dialog', (dialog) => dialog.accept())
    await card(page).getByRole('button', { name: 'Cancel Registration' }).click()
    await expect(card(page).getByRole('status')).toBeVisible()

    await page.reload()
    await expect(card(page).getByText('Your status: Cancelled')).toBeVisible()
    await expect(card(page).getByRole('button', { name: 'Cancelled' })).toBeDisabled()
  })

  test('can leave the waitlist', async ({ page, request }) => {
    await fillSession(request, TITLE)
    await page.goto('/')
    await registerInUi(page, 'Grace', 'grace@example.com', true)
    const c = card(page)
    await expect(c.getByText('Your status: Waitlisted (position 1)')).toBeVisible()
    await expect(c.getByText('1 on waitlist')).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await c.getByRole('button', { name: 'Cancel Registration' }).click()

    await expect(c.getByRole('status')).toHaveText('Your registration has been cancelled')
    await expect(c.getByText('on waitlist')).toHaveCount(0)
    await expect(c.getByText('16 / 16 registered')).toBeVisible()
  })

  test('can register again after cancelling', async ({ page }) => {
    await page.goto('/')
    await registerInUi(page, 'Ada', 'ada@example.com')
    page.once('dialog', (dialog) => dialog.accept())
    await card(page).getByRole('button', { name: 'Cancel Registration' }).click()
    await expect(card(page).getByRole('status')).toBeVisible()

    await registerInUi(page, 'Ada', 'ada@example.com')
    await expect(card(page).getByText('Your status: Confirmed')).toBeVisible()
    await expect(card(page).getByText('1 / 16 registered')).toBeVisible()
  })

  test('API: cancelling twice returns 409', async ({ request }) => {
    const session = await findSession(request, TITLE)
    const reg = await request.post(`${API_URL}/api/training-sessions/${session.id}/registrations`, {
      data: { name: 'Ada', email: 'ada@example.com' },
    })
    const { id } = await reg.json()
    const url = `${API_URL}/api/training-sessions/${session.id}/registrations/${id}`
    expect((await request.delete(url)).status()).toBe(200)
    expect((await request.delete(url)).status()).toBe(409)
  })
})

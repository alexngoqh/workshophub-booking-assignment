import { test, expect, Page } from './fixtures'
import { API_URL, findSession, registerViaApi, resetDatabase } from './helpers'

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

test.describe('LATC-5: promote first waitlisted employee after cancellation', () => {
  test('the first waitlisted employee becomes Confirmed after someone cancels', async ({
    page,
    newUserPage,
    request,
  }) => {
    const session = await findSession(request, TITLE)
    for (let i = 0; i < session.capacity - 1; i++) {
      await registerViaApi(request, session.id, `Filler ${i}`, `filler${i}@example.com`)
    }

    // Ada takes the last seat in her browser.
    await page.goto('/')
    await registerInUi(page, 'Ada', 'ada@example.com')
    await expect(card(page).getByText('16 / 16 registered')).toBeVisible()

    // Grace (another employee, another browser) joins the waitlist, then Hal behind her.
    const grace = await newUserPage()
    await grace.goto('/')
    await registerInUi(grace, 'Grace', 'grace@example.com', true)
    await expect(card(grace).getByText('Your status: Waitlisted (position 1)')).toBeVisible()
    const hal = await registerViaApi(request, session.id, 'Hal', 'hal@example.com')
    expect(hal.body.position).toBe(2)

    // Ada cancels: she only sees the standard message, and the count does not change.
    page.once('dialog', (d) => d.accept())
    await card(page).getByRole('button', { name: 'Cancel Registration' }).click()
    await expect(card(page).getByRole('status')).toHaveText('Your registration has been cancelled')
    await expect(card(page).getByText('16 / 16 registered')).toBeVisible()
    await expect(card(page).getByText('1 on waitlist')).toBeVisible()

    // Grace refreshes and sees she is now confirmed.
    await grace.reload()
    await expect(card(grace).getByText('Your status: Confirmed')).toBeVisible()
    await expect(card(grace).getByText('16 / 16 registered')).toBeVisible()

    // Hal moved up to position 1.
    const halNow = await request.get(
      `${API_URL}/api/training-sessions/${session.id}/registrations/${hal.body.id}`
    )
    expect((await halNow.json()).position).toBe(1)
  })

  test('with an empty waitlist the seat is released instead', async ({ page }) => {
    await page.goto('/')
    await registerInUi(page, 'Ada', 'ada@example.com')
    page.once('dialog', (d) => d.accept())
    await card(page).getByRole('button', { name: 'Cancel Registration' }).click()
    await expect(card(page).getByText('0 / 16 registered')).toBeVisible()
  })
})

import { test, expect, Page } from './fixtures'
import { findSession, registerViaApi, resetDatabase, setRegistrationDeadline } from './helpers'

// Seed: "AI-assisted Software Delivery Fundamentals" closes in 14 days,
// "CI/CD and Quality Gates Workshop" closed yesterday, others have no deadline.
const OPEN = 'AI-assisted Software Delivery Fundamentals'
const CLOSED = 'CI/CD and Quality Gates Workshop'
const NO_DEADLINE = 'Secure Coding with AI Assistance'

test.beforeEach(() => resetDatabase())

const card = (page: Page, title: string) => page.locator('.session-card').filter({ hasText: title })

test.describe('LATC-7: registration deadline prevents late registration', () => {
  test('a future deadline is shown next to the Register button', async ({ page }) => {
    await page.goto('/')
    const c = card(page, OPEN)
    await expect(c.getByText(/^Registration closes: .+/)).toBeVisible()
    await expect(c.getByRole('button', { name: 'Register' })).toBeVisible()
  })

  test('a passed deadline shows "Registration closed" instead of the button', async ({ page }) => {
    await page.goto('/')
    const c = card(page, CLOSED)
    await expect(c.getByText('Registration closed', { exact: true })).toBeVisible()
    await expect(c.getByRole('button', { name: 'Register' })).toHaveCount(0)
    await expect(c.getByRole('button', { name: 'Join Waitlist' })).toHaveCount(0)
    await expect(c.getByText(/Registration closes/)).toHaveCount(0)
  })

  test('a session without a deadline shows no deadline label', async ({ page }) => {
    await page.goto('/')
    const c = card(page, NO_DEADLINE)
    await expect(c.getByRole('button', { name: 'Register' })).toBeVisible()
    await expect(c.getByText(/Registration clos/)).toHaveCount(0)
  })

  test('submitting after the deadline passed while the form was open shows an inline error', async ({
    page,
    request,
  }) => {
    await page.goto('/')
    const c = card(page, OPEN)
    await c.getByRole('button', { name: 'Register' }).click()
    await c.getByLabel('Name').fill('Late Larry')
    await c.getByLabel('Email').fill('larry@example.com')

    // The cut-off passes while the page is open.
    setRegistrationDeadline(OPEN, new Date(Date.now() - 60_000))
    await c.getByRole('button', { name: 'Confirm registration' }).click()

    await expect(c.getByRole('alert')).toHaveText('Registration for this session has closed')
    await expect(c.getByText('0 / 20 registered')).toBeVisible()
    expect((await findSession(request, OPEN)).registered).toBe(0)
  })

  test('API: 422 after the deadline, 201 before it', async ({ request }) => {
    const closed = await findSession(request, CLOSED)
    const late = await registerViaApi(request, closed.id, 'Late', 'late@example.com')
    expect(late.status).toBe(422)
    expect(late.body).toEqual({ error: 'Registration deadline has passed' })

    const open = await findSession(request, OPEN)
    const ok = await registerViaApi(request, open.id, 'Early', 'early@example.com')
    expect(ok.status).toBe(201)
  })
})

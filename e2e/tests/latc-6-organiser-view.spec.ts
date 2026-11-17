import { test, expect, Page } from './fixtures'
import { API_URL, findSession, registerViaApi, resetDatabase } from './helpers'

const TITLE = 'Secure Coding with AI Assistance' // capacity 16

test.beforeEach(() => resetDatabase())

const card = (page: Page) => page.locator('.session-card').filter({ hasText: TITLE })

test.describe('LATC-6: organiser can view registrations for a session', () => {
  test('clicking a card opens the detail page and back returns to the listing', async ({
    page,
    request,
  }) => {
    const session = await findSession(request, TITLE)
    await page.goto('/')
    // Click on the card body (description), not on a button or link
    await card(page).locator('.session-card__description').click()

    await expect(page).toHaveURL(`/sessions/${session.id}`)
    await expect(page.getByRole('heading', { level: 2, name: TITLE })).toBeVisible()
    // Full session info: date, time, location, delivery mode, capacity and full description
    await expect(page.getByText('Wednesday, 29 July 2026')).toBeVisible()
    await expect(page.getByText('Training Room B, Level 2')).toBeVisible()
    await expect(page.locator('.session-detail__meta')).toContainText('In Person')
    await expect(page.locator('.session-detail__meta')).toContainText('0 / 16 registered')
    await expect(page.locator('.session-detail__description')).toHaveText(
      /^Identify and prevent common security vulnerabilities .* automated security scanning\.$/
    )
    await expect(page.getByRole('heading', { name: 'Registrations' })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'Available Training Sessions' })).toBeVisible()
  })

  test('the card title is a link to the detail page', async ({ page, request }) => {
    const session = await findSession(request, TITLE)
    await page.goto('/')
    await card(page).getByRole('link', { name: TITLE }).click()
    await expect(page).toHaveURL(`/sessions/${session.id}`)
    await page.getByRole('link', { name: '← All sessions' }).click()
    await expect(page).toHaveURL('/')
  })

  test('clicking Register on a card does not navigate', async ({ page }) => {
    await page.goto('/')
    await card(page).getByRole('button', { name: 'Register' }).click()
    await card(page).getByLabel('Name').click()
    await expect(page).toHaveURL('/')
    await expect(card(page).getByLabel('Email')).toBeVisible()
  })

  test('shows "No registrations yet" for a session without registrations', async ({
    page,
    request,
  }) => {
    const session = await findSession(request, TITLE)
    await page.goto(`/sessions/${session.id}`)
    await expect(page.getByText('No registrations yet')).toBeVisible()
  })

  test('lists confirmed and waitlisted registrants and hides cancelled ones', async ({
    page,
    request,
  }) => {
    const session = await findSession(request, TITLE)
    for (let i = 0; i < session.capacity; i++) {
      await registerViaApi(request, session.id, `Attendee ${i}`, `attendee${i}@example.com`)
    }
    const grace = await registerViaApi(request, session.id, 'Grace Hopper', 'grace@example.com')
    const hal = await registerViaApi(request, session.id, 'Hal Cancelled', 'hal@example.com')
    await request.delete(
      `${API_URL}/api/training-sessions/${session.id}/registrations/${hal.body.id}`
    )
    expect(grace.status).toBe(202)

    await page.goto(`/sessions/${session.id}`)

    await expect(page.getByRole('heading', { name: 'Confirmed (16)' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Waitlist (1)' })).toBeVisible()

    const confirmed = page.getByRole('region', { name: 'Confirmed' })
    await expect(confirmed.locator('tbody tr')).toHaveCount(16)
    await expect(confirmed.getByRole('cell', { name: 'attendee0@example.com' })).toBeVisible()

    const waitlist = page.getByRole('region', { name: 'Waitlist' })
    const row = waitlist.locator('tbody tr')
    await expect(row).toHaveCount(1)
    await expect(row.getByRole('cell', { name: 'Grace Hopper' })).toBeVisible()
    await expect(row.getByRole('cell', { name: 'grace@example.com' })).toBeVisible()
    await expect(row.locator('td').nth(2)).not.toBeEmpty()

    await expect(page.getByText('Hal Cancelled')).toHaveCount(0)
  })

  test('a deep link to an unknown session shows "Session not found"', async ({ page }) => {
    await page.goto('/sessions/999999')
    await expect(page.getByText('Session not found.')).toBeVisible()
    await page.getByRole('link', { name: '← All sessions' }).click()
    await expect(page).toHaveURL('/')
  })
})

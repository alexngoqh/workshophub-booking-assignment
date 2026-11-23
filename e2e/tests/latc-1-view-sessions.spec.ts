import { test, expect } from './fixtures'
import { resetDatabase } from './helpers'

const SEEDED_TITLES_IN_DATE_ORDER = [
  'AI-assisted Software Delivery Fundamentals',
  'TDD in Agentic Development Loop',
  'Secure Coding with AI Assistance',
  'Engineering Practices for AI-enabled Teams',
  'CI/CD and Quality Gates Workshop',
]

test.beforeEach(() => resetDatabase())

test.describe('LATC-1: view pre-seeded training sessions', () => {
  test('lists every seeded session as a card in date order', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Available Training Sessions' })).toBeVisible()

    const titles = page.locator('.session-card .session-card__title')
    await expect(titles).toHaveText(SEEDED_TITLES_IN_DATE_ORDER)
    await expect(page.getByText('5 sessions available')).toBeVisible()
  })

  test('each card shows delivery mode, date, time, location and capacity', async ({ page }) => {
    await page.goto('/')
    const card = page
      .locator('.session-card')
      .filter({ hasText: 'AI-assisted Software Delivery Fundamentals' })

    await expect(card.locator('.session-badge').first()).toHaveText(/in person/i)
    await expect(card.getByText('Date')).toBeVisible()
    await expect(card.getByText('Time')).toBeVisible()
    await expect(card.getByText('Training Room A, Level 3')).toBeVisible()
    await expect(card.getByText('0 / 20 registered')).toBeVisible()
  })

  test('shows an error state when the API request fails', async ({ page }) => {
    await page.route('**/api/training-sessions', (route) =>
      route.fulfill({ status: 500, body: '{"error":"boom"}' })
    )
    await page.goto('/')
    await expect(page.getByText('Failed to load training sessions.')).toBeVisible()
  })

  test('shows a loading state while fetching', async ({ page }) => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/api/training-sessions', async (route) => {
      await gate
      await route.continue()
    })
    await page.goto('/')
    await expect(page.getByText('Loading training sessions...')).toBeVisible()
    release()
    await expect(page.locator('.session-card')).toHaveCount(5)
  })
})

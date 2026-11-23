import { test, expect } from './fixtures'
import { API_URL, findSession, registerViaApi, resetDatabase } from './helpers'

const TITLE = 'Secure Coding with AI Assistance' // capacity 16

test.beforeEach(() => resetDatabase())

test.describe('LATC-9: audit log for registration state changes', () => {
  test('organiser finds the registration id on the detail page and reads its audit', async ({
    page,
    request,
  }) => {
    const session = await findSession(request, TITLE)
    const base = `${API_URL}/api/training-sessions/${session.id}/registrations`

    // Fill the session, waitlist Grace, then one attendee cancels -> Grace is promoted.
    const first = await registerViaApi(request, session.id, 'Attendee 0', 'attendee0@example.com')
    for (let i = 1; i < session.capacity; i++) {
      await registerViaApi(request, session.id, `Attendee ${i}`, `attendee${i}@example.com`)
    }
    const grace = await registerViaApi(request, session.id, 'Grace Hopper', 'grace@example.com')
    expect(grace.status).toBe(202)
    await request.delete(`${base}/${first.body.id}`)

    // Organiser workflow: open the session page and read Grace's registration id there.
    await page.goto(`/sessions/${session.id}`)
    const row = page.getByRole('region', { name: 'Confirmed' }).getByRole('row', {
      name: /Grace Hopper/,
    })
    await expect(row).toBeVisible()
    const idFromPage = Number(await row.getByRole('cell').first().innerText())
    expect(idFromPage).toBe(grace.body.id)

    const audit = await request.get(`${base}/${idFromPage}/audit`)
    expect(audit.status()).toBe(200)
    const history = (await audit.json()) as { fromStatus: string | null; toStatus: string }[]
    expect(history.map((e) => [e.fromStatus, e.toStatus])).toEqual([
      [null, 'waitlisted'],
      ['waitlisted', 'confirmed'],
    ])

    const cancelled = await request.get(`${base}/${first.body.id}/audit`)
    expect(
      ((await cancelled.json()) as { fromStatus: string | null; toStatus: string }[]).map((e) => [
        e.fromStatus,
        e.toStatus,
      ])
    ).toEqual([
      [null, 'confirmed'],
      ['confirmed', 'cancelled'],
    ])
  })

  test('UI actions are audited: register then cancel in the browser', async ({ page, request }) => {
    await page.goto('/')
    const card = page.locator('.session-card').filter({ hasText: TITLE })
    await card.getByRole('button', { name: 'Register' }).click()
    await card.getByLabel('Name').fill('Ada')
    await card.getByLabel('Email').fill('ada@example.com')
    await card.getByRole('button', { name: 'Confirm registration' }).click()
    await expect(card.getByRole('button', { name: 'Cancel Registration' })).toBeVisible()
    page.once('dialog', (d) => d.accept())
    await card.getByRole('button', { name: 'Cancel Registration' }).click()
    await expect(card.getByRole('status')).toHaveText('Your registration has been cancelled')

    const session = await findSession(request, TITLE)
    const id = await page.evaluate(
      (sid) =>
        JSON.parse(localStorage.getItem('workshophub.myRegistrations') || '{}')[sid].registrationId,
      String(session.id)
    )
    const audit = await request.get(
      `${API_URL}/api/training-sessions/${session.id}/registrations/${id}/audit`
    )
    const history = (await audit.json()) as { toStatus: string; reason: string }[]
    expect(history.map((e) => e.reason)).toEqual(['registered', 'cancelled'])
  })

  test('audit entries cannot be modified through the API', async ({ request }) => {
    const session = await findSession(request, TITLE)
    const a = await registerViaApi(request, session.id, 'Ada', 'ada@example.com')
    const url = `${API_URL}/api/training-sessions/${session.id}/registrations/${a.body.id}/audit`
    expect((await request.delete(url)).status()).toBe(404)
    expect((await request.put(url, { data: {} })).status()).toBe(404)
    expect(((await (await request.get(url)).json()) as unknown[]).length).toBe(1)
  })
})

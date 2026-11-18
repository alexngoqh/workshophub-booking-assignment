import request from 'supertest'
import app from '../../src/app'
import prisma from '../../src/lib/prisma'
import { createTestSession, deleteTestSessions } from './helpers'

const created: number[] = []
async function session() {
  const s = await createTestSession()
  created.push(s.id)
  return s
}

afterAll(async () => {
  await deleteTestSessions(created)
  await prisma.$disconnect()
})

const url = (id: number) => `/api/training-sessions/${id}/registrations`

const NAME_TOO_LONG_MESSAGE = 'name must be at most 100 characters'

/** Reads the `errors` field defensively (array of strings, array of {message}, or a single string). */
function errorMessages(body: any): string[] {
  const errors = body?.errors
  if (typeof errors === 'string') return [errors]
  if (!Array.isArray(errors)) return []
  return errors.map((e: any) => (typeof e === 'string' ? e : e?.message))
}

describe('POST /api/training-sessions/:id/registrations - name length (LATC-2)', () => {
  it('returns 400 with "name must be at most 100 characters" when the trimmed name is 101 characters', async () => {
    const s = await session()
    // Surrounding whitespace must be trimmed before the length is measured.
    const res = await request(app)
      .post(url(s.id))
      .send({ name: `  ${'x'.repeat(101)}  `, email: 'long-name@example.com' })

    expect(res.status).toBe(400)
    expect(errorMessages(res.body)).toContain(NAME_TOO_LONG_MESSAGE)
  })

  it('accepts a name of exactly 100 characters', async () => {
    const s = await session()
    const res = await request(app)
      .post(url(s.id))
      .send({ name: 'x'.repeat(100), email: 'exact-100@example.com' })

    expect(res.status).toBe(201)
    expect(errorMessages(res.body)).not.toContain(NAME_TOO_LONG_MESSAGE)
  })

  it('applies the limit to the trimmed name: a name that trims to exactly 100 characters is accepted', async () => {
    const s = await session()
    // Raw length is 104, but the trimmed name is exactly 100 characters.
    const res = await request(app)
      .post(url(s.id))
      .send({ name: `  ${'x'.repeat(100)}  `, email: 'trimmed-100@example.com' })

    expect(res.status).toBe(201)
    expect(errorMessages(res.body)).not.toContain(NAME_TOO_LONG_MESSAGE)
  })
})

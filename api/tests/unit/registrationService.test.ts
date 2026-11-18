import { validateRegistrationInput } from '../../src/services/registrationService'

// validateRegistrationInput is a pure function and never touches Prisma, so a stub
// keeps the unit test hermetic and free of any database.
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {},
}))

const MAX_NAME = 100

describe('validateRegistrationInput (LATC-2: name length)', () => {
  it('accepts a name at the 100-character boundary', () => {
    const errors = validateRegistrationInput({
      name: 'a'.repeat(100),
      email: 'ada@example.com',
    })

    expect(errors).not.toContain('name must be at most 100 characters')
    expect(errors).toEqual([])
  })

  it('rejects a name longer than 100 characters', () => {
    const errors = validateRegistrationInput({
      name: 'a'.repeat(MAX_NAME + 1),
      email: 'ada@example.com',
    })

    expect(errors).toContain('name must be at most 100 characters')
  })
})

import {
  REGISTRATION_STATUS,
  validateRegistrationInput,
} from '../../src/services/registrationService'

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {},
}))

describe('validateRegistrationInput', () => {
  it('returns no errors for valid input', () => {
    expect(validateRegistrationInput({ name: 'Ada', email: 'ada@example.com' })).toEqual([])
  })

  it('reports missing name and email', () => {
    expect(validateRegistrationInput({})).toEqual(['name is required', 'email is required'])
  })

  it('reports blank fields', () => {
    expect(validateRegistrationInput({ name: '   ', email: '  ' })).toEqual([
      'name is required',
      'email is required',
    ])
  })

  it('reports non-string fields as missing', () => {
    expect(validateRegistrationInput({ name: 42, email: 7 })).toEqual([
      'name is required',
      'email is required',
    ])
  })

  it('reports a malformed email', () => {
    expect(validateRegistrationInput({ name: 'Ada', email: 'not-an-email' })).toEqual([
      'email is invalid',
    ])
  })

  it('handles a null or undefined body', () => {
    expect(validateRegistrationInput(null)).toEqual(['name is required', 'email is required'])
    expect(validateRegistrationInput(undefined)).toEqual(['name is required', 'email is required'])
  })
})

describe('REGISTRATION_STATUS', () => {
  it('contains exactly confirmed, waitlisted and cancelled', () => {
    expect(Object.values(REGISTRATION_STATUS).sort()).toEqual([
      'cancelled',
      'confirmed',
      'waitlisted',
    ])
  })
})

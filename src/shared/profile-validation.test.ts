import { describe, it, expect } from 'bun:test'
import { validateProfileFields, type ProfileErrorCode } from '@/shared/profile-validation'

const SIGNUP = { require: ['firstName', 'pseudonym'] as const }
const PATCH = { require: [] as const }

function codes(input: Parameters<typeof validateProfileFields>[0], opts: Parameters<typeof validateProfileFields>[1]): ProfileErrorCode[] {
  return validateProfileFields(input, opts).issues.map((i) => i.code)
}

describe('validateProfileFields', () => {
  it('accepts a valid signup payload', () => {
    const { issues, values } = validateProfileFields(
      { firstName: 'John', lastName: 'Doe', pseudonym: 'johnd' },
      SIGNUP,
    )
    expect(issues).toEqual([])
    expect(values).toEqual({ firstName: 'John', lastName: 'Doe', pseudonym: 'johnd' })
  })

  it('trims values and returns the cleaned strings', () => {
    const { values } = validateProfileFields(
      { firstName: '  John  ', lastName: '  Doe ', pseudonym: '  johnd ' },
      SIGNUP,
    )
    expect(values).toEqual({ firstName: 'John', lastName: 'Doe', pseudonym: 'johnd' })
  })

  it('coerces non-string input before validating', () => {
    const { values } = validateProfileFields({ firstName: 123, pseudonym: 'abc' }, SIGNUP)
    expect(values.firstName).toBe('123')
  })

  // ─── signup (require firstName + pseudonym) ───────────────────────────────

  it('flags an empty first name on signup', () => {
    expect(codes({ firstName: '   ', pseudonym: 'johnd' }, SIGNUP)).toContain('first_name_empty')
  })

  it('flags a missing first name on signup', () => {
    expect(codes({ pseudonym: 'johnd' }, SIGNUP)).toContain('first_name_empty')
  })

  it('flags an over-long first name', () => {
    expect(codes({ firstName: 'a'.repeat(101), pseudonym: 'johnd' }, SIGNUP)).toContain('first_name_too_long')
  })

  it('flags an over-long last name', () => {
    expect(codes({ firstName: 'John', lastName: 'a'.repeat(101), pseudonym: 'johnd' }, SIGNUP)).toContain('last_name_too_long')
  })

  it('flags an empty pseudonym on signup', () => {
    expect(codes({ firstName: 'John', pseudonym: '' }, SIGNUP)).toContain('pseudonym_empty')
  })

  it('flags a one-character pseudonym as too short (the bug case)', () => {
    expect(codes({ firstName: 'John', pseudonym: 'a' }, SIGNUP)).toContain('pseudonym_too_short')
  })

  it('flags an over-long pseudonym', () => {
    expect(codes({ firstName: 'John', pseudonym: 'a'.repeat(31) }, SIGNUP)).toContain('pseudonym_too_long')
  })

  it('flags invalid pseudonym characters', () => {
    expect(codes({ firstName: 'John', pseudonym: 'john doe' }, SIGNUP)).toContain('pseudonym_invalid_chars')
  })

  it('accepts hyphens and underscores in the pseudonym', () => {
    expect(codes({ firstName: 'John', pseudonym: 'john_d-2' }, SIGNUP)).toEqual([])
  })

  // ─── PATCH (require nothing) ──────────────────────────────────────────────

  it('produces no issues for an empty partial PATCH', () => {
    expect(codes({}, PATCH)).toEqual([])
  })

  it('does not require firstName/pseudonym on PATCH', () => {
    expect(codes({ firstName: '', pseudonym: '' }, PATCH)).toEqual([])
  })

  it('still rejects a one-character pseudonym on PATCH (deliberate consistency change)', () => {
    expect(codes({ pseudonym: 'a' }, PATCH)).toContain('pseudonym_too_short')
  })

  it('still enforces format rules on present PATCH fields', () => {
    expect(codes({ pseudonym: 'bad name!' }, PATCH)).toContain('pseudonym_invalid_chars')
    expect(codes({ firstName: 'a'.repeat(101) }, PATCH)).toContain('first_name_too_long')
  })
})

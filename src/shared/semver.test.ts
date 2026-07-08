import { describe, it, expect } from 'bun:test'
import { satisfiesSemver } from './semver'

describe('satisfiesSemver', () => {
  it('returns true for empty/undefined range', () => {
    expect(satisfiesSemver('0.16.0', undefined)).toBe(true)
    expect(satisfiesSemver('0.16.0', '')).toBe(true)
    expect(satisfiesSemver('0.16.0', '  ')).toBe(true)
  })

  it('handles exact match', () => {
    expect(satisfiesSemver('0.16.0', '0.16.0')).toBe(true)
    expect(satisfiesSemver('0.16.1', '0.16.0')).toBe(false)
    expect(satisfiesSemver('0.16.0', '=0.16.0')).toBe(true)
  })

  it('handles >= operator', () => {
    expect(satisfiesSemver('0.16.0', '>=0.15.0')).toBe(true)
    expect(satisfiesSemver('0.15.0', '>=0.15.0')).toBe(true)
    expect(satisfiesSemver('0.14.9', '>=0.15.0')).toBe(false)
  })

  it('handles > operator', () => {
    expect(satisfiesSemver('0.16.0', '>0.15.0')).toBe(true)
    expect(satisfiesSemver('0.15.0', '>0.15.0')).toBe(false)
  })

  it('handles <= operator', () => {
    expect(satisfiesSemver('0.15.0', '<=0.16.0')).toBe(true)
    expect(satisfiesSemver('0.16.0', '<=0.16.0')).toBe(true)
    expect(satisfiesSemver('0.16.1', '<=0.16.0')).toBe(false)
  })

  it('handles < operator', () => {
    expect(satisfiesSemver('0.15.0', '<0.16.0')).toBe(true)
    expect(satisfiesSemver('0.16.0', '<0.16.0')).toBe(false)
  })

  it('handles range with AND (space-separated)', () => {
    expect(satisfiesSemver('0.16.0', '>=0.15.0 <1.0.0')).toBe(true)
    expect(satisfiesSemver('0.14.0', '>=0.15.0 <1.0.0')).toBe(false)
    expect(satisfiesSemver('1.0.0', '>=0.15.0 <1.0.0')).toBe(false)
  })

  it('handles caret ^X.Y.Z (major > 0)', () => {
    expect(satisfiesSemver('1.2.3', '^1.0.0')).toBe(true)
    expect(satisfiesSemver('1.9.9', '^1.0.0')).toBe(true)
    expect(satisfiesSemver('2.0.0', '^1.0.0')).toBe(false)
    expect(satisfiesSemver('0.9.9', '^1.0.0')).toBe(false)
  })

  it('handles caret ^0.Y.Z (major = 0)', () => {
    expect(satisfiesSemver('0.16.0', '^0.16.0')).toBe(true)
    expect(satisfiesSemver('0.16.5', '^0.16.0')).toBe(true)
    expect(satisfiesSemver('0.17.0', '^0.16.0')).toBe(false)
    expect(satisfiesSemver('0.15.9', '^0.16.0')).toBe(false)
  })

  it('handles tilde ~X.Y.Z', () => {
    expect(satisfiesSemver('0.16.0', '~0.16.0')).toBe(true)
    expect(satisfiesSemver('0.16.9', '~0.16.0')).toBe(true)
    expect(satisfiesSemver('0.17.0', '~0.16.0')).toBe(false)
    expect(satisfiesSemver('0.15.9', '~0.16.0')).toBe(false)
  })

  it('handles v-prefix in version', () => {
    expect(satisfiesSemver('v0.16.0', '>=0.15.0')).toBe(true)
  })
})

import { describe, it, expect } from 'bun:test'
import { generateSlug, isValidSlug, isUUID, ensureUniqueSlug } from './slug'

describe('generateSlug', () => {
  it('converts name to lowercase hyphenated slug', () => {
    expect(generateSlug('Test AI')).toBe('test-ai')
  })

  it('handles accented characters', () => {
    expect(generateSlug('Loser du 38')).toBe('loser-du-38')
    expect(generateSlug('café crème')).toBe('cafe-creme')
    expect(generateSlug('über cool')).toBe('uber-cool')
  })

  it('strips special characters', () => {
    expect(generateSlug('hello@world!')).toBe('hello-world')
    expect(generateSlug('foo---bar')).toBe('foo-bar')
  })

  it('trims leading and trailing hyphens', () => {
    expect(generateSlug('--hello--')).toBe('hello')
    expect(generateSlug('  spaces  ')).toBe('spaces')
  })

  it('truncates to 50 characters', () => {
    const long = 'a'.repeat(100)
    expect(generateSlug(long).length).toBeLessThanOrEqual(50)
  })

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('')
  })

  it('handles numbers only', () => {
    expect(generateSlug('12345')).toBe('12345')
  })
})

describe('isValidSlug', () => {
  it('accepts valid slugs', () => {
    expect(isValidSlug('test-ai')).toBe(true)
    expect(isValidSlug('a1')).toBe(true)
    expect(isValidSlug('hello-world-42')).toBe(true)
  })

  it('accepts single character slugs', () => {
    // regex allows single char: ^[a-z0-9](?:...)?$ where the group is optional
    expect(isValidSlug('a')).toBe(true)
    expect(isValidSlug('1')).toBe(true)
  })

  it('rejects consecutive hyphens', () => {
    expect(isValidSlug('foo--bar')).toBe(false)
  })

  it('rejects leading/trailing hyphens', () => {
    expect(isValidSlug('-foo')).toBe(false)
    expect(isValidSlug('foo-')).toBe(false)
  })

  it('rejects uppercase', () => {
    expect(isValidSlug('Hello')).toBe(false)
  })

  it('rejects special characters', () => {
    expect(isValidSlug('foo_bar')).toBe(false)
    expect(isValidSlug('foo.bar')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidSlug('')).toBe(false)
  })

  it('rejects strings over 50 chars', () => {
    expect(isValidSlug('a' + 'b'.repeat(50) + 'c')).toBe(false)
  })
})

describe('isUUID', () => {
  it('accepts valid v4 UUID', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('accepts uppercase UUID', () => {
    expect(isUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
  })

  it('rejects invalid formats', () => {
    expect(isUUID('not-a-uuid')).toBe(false)
    expect(isUUID('550e8400e29b41d4a716446655440000')).toBe(false)
    expect(isUUID('')).toBe(false)
  })
})

describe('ensureUniqueSlug', () => {
  it('returns base slug when not taken', () => {
    expect(ensureUniqueSlug('test', new Set())).toBe('test')
  })

  it('appends -2 when base is taken', () => {
    expect(ensureUniqueSlug('test', new Set(['test']))).toBe('test-2')
  })

  it('increments counter until unique', () => {
    const existing = new Set(['bot', 'bot-2', 'bot-3'])
    expect(ensureUniqueSlug('bot', existing)).toBe('bot-4')
  })
})

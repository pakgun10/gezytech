import { describe, expect, it } from 'bun:test'
import { slugify, findFreeSlug } from './provider-slug'

// ─── slugify ─────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('lowercases + collapses non-alnum into a single dash', () => {
    expect(slugify('OpenAI Codex')).toBe('openai-codex')
    expect(slugify('Anthropic Claude Max')).toBe('anthropic-claude-max')
    expect(slugify('Hello   World')).toBe('hello-world')
  })

  it('strips diacritics', () => {
    expect(slugify('Voilà')).toBe('voila')
    expect(slugify('Crème Brûlée')).toBe('creme-brulee')
    expect(slugify('Über')).toBe('uber')
  })

  it('trims leading and trailing dashes', () => {
    expect(slugify('  spaced  ')).toBe('spaced')
    expect(slugify('!!!hello!!!')).toBe('hello')
    expect(slugify('-leading-')).toBe('leading')
  })

  it('returns "provider" when nothing slug-safe is left', () => {
    expect(slugify('!!!')).toBe('provider')
    expect(slugify('')).toBe('provider')
    expect(slugify('   ')).toBe('provider')
  })

  it('preserves digits and pre-existing dashes', () => {
    expect(slugify('GPT-5.5')).toBe('gpt-5-5')
    expect(slugify('claude-3-opus')).toBe('claude-3-opus')
    expect(slugify('row 2')).toBe('row-2')
  })
})

// ─── findFreeSlug ────────────────────────────────────────────────────────────

describe('findFreeSlug', () => {
  it('returns the base slug when free', () => {
    expect(findFreeSlug('openai', new Set())).toBe('openai')
    expect(findFreeSlug('openai', new Set(['other']))).toBe('openai')
  })

  it('appends -2 on first collision', () => {
    expect(findFreeSlug('openai', new Set(['openai']))).toBe('openai-2')
  })

  it('walks up the counter past several collisions', () => {
    const taken = new Set(['openai', 'openai-2', 'openai-3'])
    expect(findFreeSlug('openai', taken)).toBe('openai-4')
  })

  it('does not mutate the input set', () => {
    const taken = new Set(['openai'])
    findFreeSlug('openai', taken)
    expect(taken.has('openai-2')).toBe(false)
    expect(taken.size).toBe(1)
  })

  it('is pure: same input yields same output', () => {
    const taken = new Set(['x', 'x-2'])
    expect(findFreeSlug('x', taken)).toBe('x-3')
    expect(findFreeSlug('x', taken)).toBe('x-3')
  })
})

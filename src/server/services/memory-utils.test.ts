import { describe, it, expect } from 'bun:test'
import { recencyBoost } from './memory-utils'

describe('recencyBoost', () => {
  // ─── Disabled / null cases ───────────────────────────────────────────────

  it('returns 1 when recencyBoostEnabled is false', () => {
    const now = new Date()
    expect(recencyBoost(now, false)).toBe(1)
  })

  it('returns 1 when updatedAt is null', () => {
    expect(recencyBoost(null, true)).toBe(1)
  })

  it('returns 1 when both disabled and null', () => {
    expect(recencyBoost(null, false)).toBe(1)
  })

  // ─── Today (≤1 day) → 1.5 ───────────────────────────────────────────────

  it('returns 1.5 for a memory updated just now', () => {
    expect(recencyBoost(new Date(), true)).toBe(1.5)
  })

  it('returns 1.5 for a memory updated 1 hour ago', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000)
    expect(recencyBoost(oneHourAgo, true)).toBe(1.5)
  })

  it('returns 1.5 for a memory updated 23 hours ago', () => {
    const ago = new Date(Date.now() - 23 * 60 * 60 * 1000)
    expect(recencyBoost(ago, true)).toBe(1.5)
  })

  it('returns 1.5 for a memory updated exactly 1 day ago', () => {
    const ago = new Date(Date.now() - 24 * 60 * 60 * 1000)
    expect(recencyBoost(ago, true)).toBe(1.5)
  })

  // ─── This week (1-7 days) → 1.25 ────────────────────────────────────────

  it('returns 1.25 for a memory updated 2 days ago', () => {
    const ago = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    expect(recencyBoost(ago, true)).toBe(1.25)
  })

  it('returns 1.25 for a memory updated 5 days ago', () => {
    const ago = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    expect(recencyBoost(ago, true)).toBe(1.25)
  })

  it('returns 1.25 for a memory updated exactly 7 days ago', () => {
    const ago = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    expect(recencyBoost(ago, true)).toBe(1.25)
  })

  // ─── This month (7-30 days) → 1.1 ───────────────────────────────────────

  it('returns 1.1 for a memory updated 8 days ago', () => {
    const ago = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    expect(recencyBoost(ago, true)).toBe(1.1)
  })

  it('returns 1.1 for a memory updated 15 days ago', () => {
    const ago = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
    expect(recencyBoost(ago, true)).toBe(1.1)
  })

  it('returns 1.1 for a memory updated exactly 30 days ago', () => {
    const ago = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    expect(recencyBoost(ago, true)).toBe(1.1)
  })

  // ─── Older (>30 days) → 1.0 ─────────────────────────────────────────────

  it('returns 1.0 for a memory updated 31 days ago', () => {
    const ago = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    expect(recencyBoost(ago, true)).toBe(1.0)
  })

  it('returns 1.0 for a memory updated 90 days ago', () => {
    const ago = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    expect(recencyBoost(ago, true)).toBe(1.0)
  })

  it('returns 1.0 for a memory updated 365 days ago', () => {
    const ago = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    expect(recencyBoost(ago, true)).toBe(1.0)
  })

  // ─── Edge: future dates ──────────────────────────────────────────────────

  it('returns 1.5 for a future date (negative daysSince)', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
    // daysSince will be negative (< 1), so it hits the first branch
    expect(recencyBoost(future, true)).toBe(1.5)
  })

  // ─── Boundary precision ─────────────────────────────────────────────────

  it('returns 1.25 for 1 day + 1 millisecond ago (just past the 1-day boundary)', () => {
    const ago = new Date(Date.now() - (24 * 60 * 60 * 1000 + 1))
    expect(recencyBoost(ago, true)).toBe(1.25)
  })

  it('returns 1.1 for 7 days + 1 millisecond ago (just past the 7-day boundary)', () => {
    const ago = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000 + 1))
    expect(recencyBoost(ago, true)).toBe(1.1)
  })

  it('returns 1.0 for 30 days + 1 millisecond ago (just past the 30-day boundary)', () => {
    const ago = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000 + 1))
    expect(recencyBoost(ago, true)).toBe(1.0)
  })

  // ─── Return type ────────────────────────────────────────────────────────

  it('always returns a number', () => {
    expect(typeof recencyBoost(new Date(), true)).toBe('number')
    expect(typeof recencyBoost(null, true)).toBe('number')
    expect(typeof recencyBoost(new Date(), false)).toBe('number')
  })

  it('always returns >= 1.0', () => {
    const dates = [
      new Date(),
      new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      null,
    ]
    for (const d of dates) {
      for (const enabled of [true, false]) {
        expect(recencyBoost(d, enabled)).toBeGreaterThanOrEqual(1.0)
      }
    }
  })

  it('boost decreases monotonically with age when enabled', () => {
    const ages = [0, 0.5, 1, 2, 7, 8, 15, 30, 31, 100].map(
      (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    )
    const boosts = ages.map((d) => recencyBoost(d, true))
    for (let i = 1; i < boosts.length; i++) {
      expect(boosts[i]!).toBeLessThanOrEqual(boosts[i - 1]!)
    }
  })
})

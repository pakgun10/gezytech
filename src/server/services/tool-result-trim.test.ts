import { describe, it, expect } from 'bun:test'
import {
  summarizeOversizedToolResultValue,
  toolResultValueToString,
} from '@/server/services/tool-result-trim'

describe('toolResultValueToString', () => {
  it('returns the string as-is when already a string', () => {
    expect(toolResultValueToString('stdout: hello\n')).toBe('stdout: hello\n')
  })

  it('JSON-stringifies objects', () => {
    expect(toolResultValueToString({ stdout: 'ok' })).toBe('{"stdout":"ok"}')
  })

  it('JSON-stringifies arrays', () => {
    expect(toolResultValueToString([1, 'two'])).toBe('[1,"two"]')
  })

  it('returns empty string for null/undefined', () => {
    expect(toolResultValueToString(null)).toBe('')
    expect(toolResultValueToString(undefined)).toBe('')
  })
})

describe('summarizeOversizedToolResultValue', () => {
  const CAP = 30_000
  const ORIGINAL = 80_000

  /** A string longer than HEAD+TAIL (4000+ chars) so the head/tail path runs. */
  function longString(seed: string, total: number): string {
    const out = new Array<string>(total)
    for (let i = 0; i < total; i++) out[i] = seed[i % seed.length] || 'x'
    return out.join('')
  }

  it('preserves the first HEAD_CHARS and last TAIL_CHARS of a string value', () => {
    const text = longString('abcdefghij', 8000)
    const result = summarizeOversizedToolResultValue(text, 'run_shell', CAP, ORIGINAL)
    // Head preserved from index 0
    expect(result.slice(0, 2000)).toBe(text.slice(0, 2000))
    // Tail preserved from -TAIL_CHARS (after the landmark splits)
    expect(result.endsWith(text.slice(-2000))).toBe(true)
    expect(result.length).toBeLessThan(text.length)
  })

  it('includes a contextual landmark line with tool name + original tokens + cap + re-run hint', () => {
    const text = longString('z', 9000)
    const result = summarizeOversizedToolResultValue(text, 'read_file', CAP, ORIGINAL)
    expect(result).toContain('[…tool result trimmed: read_file')
    expect(result).toContain('returned ~80,000 tokens')
    expect(result).toContain('exceeding the 30,000-token keep-window cap')
    expect(result).toContain('re-run read_file if you need the full output')
  })

  it('uses "unknown" when no tool name is given', () => {
    const text = longString('z', 9000)
    const result = summarizeOversizedToolResultValue(text, undefined, CAP, ORIGINAL)
    expect(result).toContain('[…tool result trimmed: unknown')
    expect(result).toContain('re-run unknown if you need the full output')
  })

  it('cache-safe: deterministic per message — same input always same output', () => {
    const text = longString('q', 9000)
    const a = summarizeOversizedToolResultValue(text, 'browse_url', CAP, ORIGINAL)
    const b = summarizeOversizedToolResultValue(text, 'browse_url', CAP, ORIGINAL)
    expect(a).toBe(b)
  })

  it('serializes object values before slicing (stringify path)', () => {
    // Object bigger than HEAD+TAIL when serialized
    const obj = { stdout: longString('S', 4500), stderr: longString('E', 4500) }
    const json = JSON.stringify(obj)
    const result = summarizeOversizedToolResultValue(obj, 'run_code', CAP, ORIGINAL)
    // Head comes from the JSON string start (so it includes the key name)
    expect(result.slice(0, '{'.length)).toBe('{')
    expect(result).toContain('[…tool result trimmed: run_code')
    expect(result.endsWith(json.slice(-2000))).toBe(true)
  })

  it('falls back to verbatim for short payloads (defensive branch)', () => {
    const short = 'only a few hundred chars - well under the cap gate'
    const result = summarizeOversizedToolResultValue(short, 'read_file', CAP, ORIGINAL)
    expect(result).toBe(short)
    // short payloads should NOT get a landmark line
    expect(result).not.toContain('tool result trimmed:')
  })

  it('localizes counts with separators (matches existing inline wording)', () => {
    const text = longString('a', 9000)
    const result = summarizeOversizedToolResultValue(text, 'run_shell', 1234567, 9876543)
    expect(result).toContain('returned ~9,876,543 tokens')
    expect(result).toContain('exceeding the 1,234,567-token keep-window cap')
  })

  it('output is strictly smaller than the original oversized content', () => {
    const text = longString('m', 20000)
    const result = summarizeOversizedToolResultValue(text, 'run_shell', CAP, ORIGINAL)
    expect(result.length).toBeLessThan(text.length)
  })
})

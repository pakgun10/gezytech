import { describe, it, expect, beforeEach } from 'bun:test'
import {
  pushConsoleEntry,
  getConsoleEntries,
  clearConsoleEntries,
  type ConsoleEntry,
} from './mini-app-console'

// Helper to create a console entry
function makeEntry(
  level: ConsoleEntry['level'] = 'log',
  args: string[] = ['hello'],
  stack: string | null = null,
): ConsoleEntry {
  return { level, args, stack, timestamp: Date.now() }
}

describe('mini-app-console', () => {
  const APP_ID = `test-app-${Date.now()}-${Math.random()}`

  beforeEach(() => {
    clearConsoleEntries(APP_ID)
  })

  // ─── pushConsoleEntry ────────────────────────────────────────────────────

  describe('pushConsoleEntry', () => {
    it('adds an entry to the buffer', () => {
      pushConsoleEntry(APP_ID, makeEntry('log', ['test message']))
      const entries = getConsoleEntries(APP_ID)
      expect(entries).toHaveLength(1)
      expect(entries[0]!.args).toEqual(['test message'])
    })

    it('adds multiple entries in order', () => {
      pushConsoleEntry(APP_ID, makeEntry('log', ['first']))
      pushConsoleEntry(APP_ID, makeEntry('warn', ['second']))
      pushConsoleEntry(APP_ID, makeEntry('error', ['third']))

      const entries = getConsoleEntries(APP_ID)
      expect(entries).toHaveLength(3)
      expect(entries[0]!.args).toEqual(['first'])
      expect(entries[1]!.args).toEqual(['second'])
      expect(entries[2]!.args).toEqual(['third'])
    })

    it('preserves stack traces', () => {
      const stack = 'Error: boom\n    at foo.js:1:1'
      pushConsoleEntry(APP_ID, makeEntry('error', ['boom'], stack))

      const entries = getConsoleEntries(APP_ID)
      expect(entries[0]!.stack).toBe(stack)
    })

    it('preserves null stack', () => {
      pushConsoleEntry(APP_ID, makeEntry('log', ['no stack'], null))
      const entries = getConsoleEntries(APP_ID)
      expect(entries[0]!.stack).toBeNull()
    })

    it('preserves timestamps', () => {
      const entry = makeEntry('log', ['timed'])
      const before = Date.now()
      pushConsoleEntry(APP_ID, entry)

      const entries = getConsoleEntries(APP_ID)
      expect(entries[0]!.timestamp).toBe(entry.timestamp)
      expect(entries[0]!.timestamp).toBeLessThanOrEqual(before + 1000)
    })

    it('handles empty args array', () => {
      pushConsoleEntry(APP_ID, makeEntry('log', []))
      const entries = getConsoleEntries(APP_ID)
      expect(entries[0]!.args).toEqual([])
    })

    it('handles multiple args', () => {
      pushConsoleEntry(APP_ID, makeEntry('log', ['a', 'b', 'c', '123']))
      const entries = getConsoleEntries(APP_ID)
      expect(entries[0]!.args).toEqual(['a', 'b', 'c', '123'])
    })

    it('enforces ring buffer max of 50 entries', () => {
      for (let i = 0; i < 60; i++) {
        pushConsoleEntry(APP_ID, makeEntry('log', [`msg-${i}`]))
      }

      const entries = getConsoleEntries(APP_ID)
      expect(entries).toHaveLength(50)
      // Oldest entries (0-9) should be evicted, first entry should be msg-10
      expect(entries[0]!.args).toEqual(['msg-10'])
      expect(entries[49]!.args).toEqual(['msg-59'])
    })

    it('evicts oldest entry when buffer is full', () => {
      // Fill to exactly 50
      for (let i = 0; i < 50; i++) {
        pushConsoleEntry(APP_ID, makeEntry('log', [`entry-${i}`]))
      }
      expect(getConsoleEntries(APP_ID)).toHaveLength(50)

      // Push one more
      pushConsoleEntry(APP_ID, makeEntry('log', ['new-entry']))
      const entries = getConsoleEntries(APP_ID)
      expect(entries).toHaveLength(50)
      expect(entries[0]!.args).toEqual(['entry-1']) // entry-0 evicted
      expect(entries[49]!.args).toEqual(['new-entry'])
    })

    it('isolates entries between different app IDs', () => {
      const OTHER_APP = `other-${APP_ID}`
      clearConsoleEntries(OTHER_APP)

      pushConsoleEntry(APP_ID, makeEntry('log', ['app1']))
      pushConsoleEntry(OTHER_APP, makeEntry('warn', ['app2']))

      expect(getConsoleEntries(APP_ID)).toHaveLength(1)
      expect(getConsoleEntries(APP_ID)[0]!.args).toEqual(['app1'])
      expect(getConsoleEntries(OTHER_APP)).toHaveLength(1)
      expect(getConsoleEntries(OTHER_APP)[0]!.args).toEqual(['app2'])

      clearConsoleEntries(OTHER_APP)
    })
  })

  // ─── getConsoleEntries ───────────────────────────────────────────────────

  describe('getConsoleEntries', () => {
    it('returns empty array for unknown app ID', () => {
      const entries = getConsoleEntries('nonexistent-app-id')
      expect(entries).toEqual([])
    })

    it('returns a copy (not the internal buffer reference)', () => {
      pushConsoleEntry(APP_ID, makeEntry('log', ['test']))
      const entries1 = getConsoleEntries(APP_ID)
      const entries2 = getConsoleEntries(APP_ID)

      // Should be equal but not the same array reference
      expect(entries1).toEqual(entries2)
      expect(entries1).not.toBe(entries2)
    })

    it('filters by level: log', () => {
      pushConsoleEntry(APP_ID, makeEntry('log', ['info msg']))
      pushConsoleEntry(APP_ID, makeEntry('warn', ['warning']))
      pushConsoleEntry(APP_ID, makeEntry('error', ['err']))
      pushConsoleEntry(APP_ID, makeEntry('log', ['another log']))

      const logs = getConsoleEntries(APP_ID, 'log')
      expect(logs).toHaveLength(2)
      expect(logs[0]!.args).toEqual(['info msg'])
      expect(logs[1]!.args).toEqual(['another log'])
    })

    it('filters by level: warn', () => {
      pushConsoleEntry(APP_ID, makeEntry('log', ['a']))
      pushConsoleEntry(APP_ID, makeEntry('warn', ['b']))
      pushConsoleEntry(APP_ID, makeEntry('error', ['c']))

      const warns = getConsoleEntries(APP_ID, 'warn')
      expect(warns).toHaveLength(1)
      expect(warns[0]!.level).toBe('warn')
    })

    it('filters by level: error', () => {
      pushConsoleEntry(APP_ID, makeEntry('log', ['a']))
      pushConsoleEntry(APP_ID, makeEntry('error', ['b']))
      pushConsoleEntry(APP_ID, makeEntry('error', ['c']))

      const errors = getConsoleEntries(APP_ID, 'error')
      expect(errors).toHaveLength(2)
      errors.forEach((e) => expect(e.level).toBe('error'))
    })

    it('returns empty array when filtering for level with no matches', () => {
      pushConsoleEntry(APP_ID, makeEntry('log', ['only logs']))

      const errors = getConsoleEntries(APP_ID, 'error')
      expect(errors).toEqual([])
    })

    it('returns all entries when level is undefined', () => {
      pushConsoleEntry(APP_ID, makeEntry('log', ['a']))
      pushConsoleEntry(APP_ID, makeEntry('warn', ['b']))
      pushConsoleEntry(APP_ID, makeEntry('error', ['c']))

      const all = getConsoleEntries(APP_ID)
      expect(all).toHaveLength(3)
    })
  })

  // ─── clearConsoleEntries ─────────────────────────────────────────────────

  describe('clearConsoleEntries', () => {
    it('removes all entries for an app', () => {
      pushConsoleEntry(APP_ID, makeEntry('log', ['a']))
      pushConsoleEntry(APP_ID, makeEntry('warn', ['b']))
      expect(getConsoleEntries(APP_ID)).toHaveLength(2)

      clearConsoleEntries(APP_ID)
      expect(getConsoleEntries(APP_ID)).toEqual([])
    })

    it('does not throw for unknown app ID', () => {
      expect(() => clearConsoleEntries('does-not-exist')).not.toThrow()
    })

    it('does not affect other apps', () => {
      const OTHER_APP = `other-clear-${APP_ID}`
      pushConsoleEntry(APP_ID, makeEntry('log', ['keep']))
      pushConsoleEntry(OTHER_APP, makeEntry('log', ['remove']))

      clearConsoleEntries(OTHER_APP)

      expect(getConsoleEntries(APP_ID)).toHaveLength(1)
      expect(getConsoleEntries(OTHER_APP)).toEqual([])
    })

    it('allows new entries after clearing', () => {
      pushConsoleEntry(APP_ID, makeEntry('log', ['before']))
      clearConsoleEntries(APP_ID)
      pushConsoleEntry(APP_ID, makeEntry('warn', ['after']))

      const entries = getConsoleEntries(APP_ID)
      expect(entries).toHaveLength(1)
      expect(entries[0]!.args).toEqual(['after'])
    })
  })

  // ─── Edge cases ──────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles rapid sequential pushes', () => {
      for (let i = 0; i < 100; i++) {
        pushConsoleEntry(APP_ID, makeEntry('log', [`rapid-${i}`]))
      }
      const entries = getConsoleEntries(APP_ID)
      expect(entries).toHaveLength(50) // ring buffer cap
      expect(entries[0]!.args).toEqual(['rapid-50'])
    })

    it('handles all three levels interleaved at buffer boundary', () => {
      const levels: ConsoleEntry['level'][] = ['log', 'warn', 'error']
      for (let i = 0; i < 51; i++) {
        pushConsoleEntry(APP_ID, makeEntry(levels[i % 3]!, [`item-${i}`]))
      }

      const entries = getConsoleEntries(APP_ID)
      expect(entries).toHaveLength(50)
      // First entry should be item-1 (item-0 evicted)
      expect(entries[0]!.args).toEqual(['item-1'])
    })

    it('supports very long args strings', () => {
      const longStr = 'x'.repeat(10000)
      pushConsoleEntry(APP_ID, makeEntry('log', [longStr]))

      const entries = getConsoleEntries(APP_ID)
      expect(entries[0]!.args[0]).toHaveLength(10000)
    })

    it('supports empty string app ID', () => {
      clearConsoleEntries('')
      pushConsoleEntry('', makeEntry('log', ['empty id']))
      expect(getConsoleEntries('')).toHaveLength(1)
      clearConsoleEntries('')
    })
  })
})

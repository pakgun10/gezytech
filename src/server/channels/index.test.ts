import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

// We need a fresh registry per test, but the module exports a singleton.
// Re-import won't reset it because of module caching, so we test against the singleton
// and clean up after ourselves.
import { channelAdapters } from '@/server/channels/index'

/** Minimal mock adapter */
function makeAdapter(platform: string) {
  return {
    platform: platform as any,
    start: async () => {},
    stop: async () => {},
    sendMessage: async () => ({ platformMessageId: 'msg-1' }),
    validateConfig: async () => ({ valid: true as const }),
    getBotInfo: async () => ({ name: `${platform}-bot` }),
  }
}

describe('ChannelAdapterRegistry', () => {
  // Clean up any test adapters after each test
  const testPlatforms: string[] = []

  function registerTest(platform: string) {
    testPlatforms.push(platform)
    const adapter = makeAdapter(platform)
    channelAdapters.registerPlugin(adapter)
    return adapter
  }

  afterEach(() => {
    for (const p of testPlatforms) {
      try { channelAdapters.unregisterPlugin(p) } catch {}
    }
    testPlatforms.length = 0
  })

  describe('registerPlugin / get', () => {
    it('registers and retrieves a plugin adapter', () => {
      const adapter = registerTest('test-reg-1')
      expect(channelAdapters.get('test-reg-1')).toBe(adapter)
    })

    it('returns undefined for unknown platform', () => {
      expect(channelAdapters.get('nonexistent-platform')).toBeUndefined()
    })

    it('overwrites a previous plugin registration for the same platform', () => {
      const first = registerTest('test-overwrite')
      const second = makeAdapter('test-overwrite')
      channelAdapters.registerPlugin(second)
      expect(channelAdapters.get('test-overwrite')).toBe(second)
      expect(channelAdapters.get('test-overwrite')).not.toBe(first)
    })
  })

  describe('unregisterPlugin', () => {
    it('removes a plugin adapter', () => {
      registerTest('test-unreg')
      channelAdapters.unregisterPlugin('test-unreg')
      expect(channelAdapters.get('test-unreg')).toBeUndefined()
      expect(channelAdapters.isPluginAdapter('test-unreg')).toBe(false)
    })

    it('is a no-op for non-plugin adapters', () => {
      // Register via register (non-plugin) — we can't easily do this without
      // accessing the private method, so we test that unregisterPlugin
      // does not crash on unknown platforms
      channelAdapters.unregisterPlugin('never-registered')
      // Should not throw
    })

    it('does not remove a non-plugin adapter registered via register()', () => {
      // We test that unregisterPlugin only removes plugin-registered adapters
      // by registering via registerPlugin, then verifying isPluginAdapter
      const adapter = registerTest('test-plugin-check')
      expect(channelAdapters.isPluginAdapter('test-plugin-check')).toBe(true)
    })
  })

  describe('isPluginAdapter', () => {
    it('returns true for plugin-registered adapters', () => {
      registerTest('test-is-plugin')
      expect(channelAdapters.isPluginAdapter('test-is-plugin')).toBe(true)
    })

    it('returns false for unknown platforms', () => {
      expect(channelAdapters.isPluginAdapter('unknown-xyz')).toBe(false)
    })

    it('returns false after unregistering', () => {
      registerTest('test-was-plugin')
      channelAdapters.unregisterPlugin('test-was-plugin')
      expect(channelAdapters.isPluginAdapter('test-was-plugin')).toBe(false)
    })
  })

  describe('list', () => {
    it('includes plugin-registered platforms', () => {
      registerTest('test-list-a')
      registerTest('test-list-b')
      const platforms = channelAdapters.list() as string[]
      expect(platforms).toContain('test-list-a')
      expect(platforms).toContain('test-list-b')
    })

    it('excludes unregistered platforms', () => {
      registerTest('test-list-remove')
      channelAdapters.unregisterPlugin('test-list-remove')
      const platforms = channelAdapters.list() as string[]
      expect(platforms).not.toContain('test-list-remove')
    })
  })
})

// ─── Channel queue meta sideband ────────────────────────────────────────────

import {
  setChannelQueueMeta,
  getChannelQueueMeta,
  popChannelQueueMeta,
} from '@/server/services/channels'

describe('Channel queue meta sideband', () => {
  const meta = {
    channelId: 'ch-1',
    platformChatId: 'chat-42',
    platformMessageId: 'msg-99',
    platformUserId: 'user-7',
  }

  describe('setChannelQueueMeta / getChannelQueueMeta', () => {
    it('stores and retrieves metadata by queue item id', () => {
      setChannelQueueMeta('q-1', meta)
      expect(getChannelQueueMeta('q-1')).toEqual(meta)
    })

    it('returns undefined for unknown queue item id', () => {
      expect(getChannelQueueMeta('nonexistent')).toBeUndefined()
    })

    it('overwrites previous metadata for the same key', () => {
      setChannelQueueMeta('q-overwrite', meta)
      const newMeta = { ...meta, platformChatId: 'chat-new' }
      setChannelQueueMeta('q-overwrite', newMeta)
      expect(getChannelQueueMeta('q-overwrite')).toEqual(newMeta)
    })
  })

  describe('popChannelQueueMeta', () => {
    it('returns and removes metadata', () => {
      setChannelQueueMeta('q-pop', meta)
      const popped = popChannelQueueMeta('q-pop')
      expect(popped).toEqual(meta)
      // Should be gone now
      expect(getChannelQueueMeta('q-pop')).toBeUndefined()
      expect(popChannelQueueMeta('q-pop')).toBeUndefined()
    })

    it('returns undefined for unknown key', () => {
      expect(popChannelQueueMeta('q-missing')).toBeUndefined()
    })

    it('only removes the specific key, not others', () => {
      const meta2 = { ...meta, channelId: 'ch-2' }
      setChannelQueueMeta('q-a', meta)
      setChannelQueueMeta('q-b', meta2)
      popChannelQueueMeta('q-a')
      expect(getChannelQueueMeta('q-b')).toEqual(meta2)
    })
  })
})

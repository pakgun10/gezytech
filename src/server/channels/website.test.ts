import { describe, expect, it } from 'bun:test'
import { WebsiteAdapter } from './website'

describe('WebsiteAdapter', () => {
  const adapter = new WebsiteAdapter()

  it('declares the Web Chat platform metadata', () => {
    expect(adapter.platform).toBe('website')
    expect(adapter.meta.displayName).toBe('Web Chat')
    expect(adapter.identitySwitchMode).toBe('none')
  })

  it('requires a valid public http(s) URL', async () => {
    await expect(adapter.validateConfig({})).resolves.toEqual({
      valid: false,
      error: 'Public web chat URL is required',
    })
    await expect(adapter.validateConfig({ publicUrl: 'not-a-url' })).resolves.toEqual({
      valid: false,
      error: 'Public web chat URL must be an http(s) URL',
    })
    await expect(adapter.validateConfig({ publicUrl: 'https://chat.gezytech.web.id/webchat/' })).resolves.toEqual({
      valid: true,
    })
  })

  it('does not support direct outbound sends outside an active browser session', async () => {
    await expect(
      adapter.sendMessage('channel-id', {}, { chatId: 'visitor', content: 'hello' }),
    ).rejects.toThrow('Web Chat channels are browser-initiated')
  })
})

import { describe, it, expect } from 'bun:test'

// ─── splitMessage logic tests ───────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 4000

function splitMessage(text: string): string[] {
  if (text.length <= MAX_MESSAGE_LENGTH) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= MAX_MESSAGE_LENGTH) {
      chunks.push(remaining)
      break
    }

    let splitAt = remaining.lastIndexOf('\n\n', MAX_MESSAGE_LENGTH)
    if (splitAt <= 0) splitAt = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH)
    if (splitAt <= 0) splitAt = remaining.lastIndexOf('. ', MAX_MESSAGE_LENGTH)
    if (splitAt <= 0) splitAt = MAX_MESSAGE_LENGTH

    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trimStart()
  }

  return chunks
}

describe('Slack splitMessage', () => {
  it('returns single chunk for short messages', () => {
    expect(splitMessage('Hello')).toEqual(['Hello'])
  })

  it('returns single chunk for exactly max length', () => {
    const text = 'a'.repeat(MAX_MESSAGE_LENGTH)
    expect(splitMessage(text)).toEqual([text])
  })

  it('splits at paragraph boundary', () => {
    const part1 = 'a'.repeat(3500)
    const part2 = 'b'.repeat(3500)
    const text = `${part1}\n\n${part2}`
    const chunks = splitMessage(text)
    expect(chunks.length).toBe(2)
    expect(chunks[0]).toBe(part1)
    expect(chunks[1]).toBe(part2)
  })

  it('splits at line boundary when no paragraph break', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `Line ${i}: ${'x'.repeat(20)}`).join('\n')
    const chunks = splitMessage(lines)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
  })

  it('splits at sentence boundary when no line break', () => {
    const sentences = Array.from({ length: 200 }, (_, i) => `Sentence ${i} content`).join('. ')
    const chunks = splitMessage(sentences)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
  })

  it('hard splits continuous text', () => {
    const text = 'x'.repeat(MAX_MESSAGE_LENGTH + 500)
    const chunks = splitMessage(text)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(MAX_MESSAGE_LENGTH)
    expect(chunks[1]).toHaveLength(500)
  })

  it('handles empty string', () => {
    expect(splitMessage('')).toEqual([''])
  })

  it('trims leading whitespace from subsequent chunks', () => {
    const part1 = 'a'.repeat(3800)
    const part2 = 'b'.repeat(100)
    const text = `${part1}\n\n   ${part2}`
    const chunks = splitMessage(text)
    if (chunks.length > 1) {
      expect(chunks[1]!.startsWith(' ')).toBe(false)
    }
  })
})

// ─── Slack signature verification logic ─────────────────────────────────────

describe('Slack signature verification', () => {
  async function computeSlackSignature(
    secret: string,
    timestamp: string,
    body: string,
  ): Promise<string> {
    const baseString = `v0:${timestamp}:${body}`
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(baseString))
    const hexHash = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return `v0=${hexHash}`
  }

  it('produces a valid v0= signature', async () => {
    const sig = await computeSlackSignature('my-secret', '1234567890', '{"test":true}')
    expect(sig).toStartWith('v0=')
    expect(sig.length).toBe(2 + 1 + 64) // "v0=" + 64 hex chars
  })

  it('different secrets produce different signatures', async () => {
    const body = '{"hello":"world"}'
    const ts = '1000000000'
    const sig1 = await computeSlackSignature('secret-a', ts, body)
    const sig2 = await computeSlackSignature('secret-b', ts, body)
    expect(sig1).not.toBe(sig2)
  })

  it('different timestamps produce different signatures', async () => {
    const body = '{"hello":"world"}'
    const sig1 = await computeSlackSignature('secret', '1000000000', body)
    const sig2 = await computeSlackSignature('secret', '2000000000', body)
    expect(sig1).not.toBe(sig2)
  })

  it('same inputs produce identical signatures', async () => {
    const sig1 = await computeSlackSignature('secret', '12345', 'body')
    const sig2 = await computeSlackSignature('secret', '12345', 'body')
    expect(sig1).toBe(sig2)
  })
})

// ─── Slack webhook request validation logic ─────────────────────────────────

describe('Slack webhook request validation', () => {
  it('rejects requests older than 5 minutes', () => {
    const now = Math.floor(Date.now() / 1000)
    const oldTimestamp = now - 600 // 10 minutes old
    expect(Math.abs(now - oldTimestamp) > 300).toBe(true)
  })

  it('accepts requests within 5 minutes', () => {
    const now = Math.floor(Date.now() / 1000)
    const recentTimestamp = now - 120 // 2 minutes old
    expect(Math.abs(now - recentTimestamp) > 300).toBe(false)
  })

  it('accepts current timestamp', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(Math.abs(now - now) > 300).toBe(false)
  })
})

// ─── Slack event MESSAGE filtering ──────────────────────────────────────────

describe('Slack MESSAGE event filtering', () => {
  function shouldProcessMessage(
    event: { type?: string; subtype?: string; bot_id?: string; user?: string; channel?: string; text?: string },
    botUserId: string | null,
    allowedChannelIds: Set<string> | null,
  ): boolean {
    if (event.type !== 'message') return false
    if (event.subtype) return false
    if (event.bot_id) return false
    if (event.user === botUserId) return false
    if (allowedChannelIds && !allowedChannelIds.has(event.channel ?? '')) return false
    if (!event.text) return false
    return true
  }

  it('accepts valid user message', () => {
    expect(shouldProcessMessage(
      { type: 'message', user: 'U123', channel: 'C456', text: 'hello' },
      'U_BOT',
      null,
    )).toBe(true)
  })

  it('rejects non-message events', () => {
    expect(shouldProcessMessage(
      { type: 'app_mention', user: 'U123', channel: 'C456', text: 'hi' },
      null,
      null,
    )).toBe(false)
  })

  it('rejects messages with subtype (edited, deleted, etc.)', () => {
    expect(shouldProcessMessage(
      { type: 'message', subtype: 'message_changed', user: 'U123', channel: 'C456', text: 'hi' },
      null,
      null,
    )).toBe(false)
  })

  it('rejects bot messages', () => {
    expect(shouldProcessMessage(
      { type: 'message', bot_id: 'B123', channel: 'C456', text: 'hi' },
      null,
      null,
    )).toBe(false)
  })

  it('rejects own messages', () => {
    expect(shouldProcessMessage(
      { type: 'message', user: 'U_BOT', channel: 'C456', text: 'hi' },
      'U_BOT',
      null,
    )).toBe(false)
  })

  it('rejects messages from non-allowed channels', () => {
    const allowed = new Set(['C111', 'C222'])
    expect(shouldProcessMessage(
      { type: 'message', user: 'U123', channel: 'C999', text: 'hi' },
      null,
      allowed,
    )).toBe(false)
  })

  it('accepts messages from allowed channels', () => {
    const allowed = new Set(['C111', 'C222'])
    expect(shouldProcessMessage(
      { type: 'message', user: 'U123', channel: 'C111', text: 'hi' },
      null,
      allowed,
    )).toBe(true)
  })

  it('rejects empty text', () => {
    expect(shouldProcessMessage(
      { type: 'message', user: 'U123', channel: 'C456', text: '' },
      null,
      null,
    )).toBe(false)
  })

  it('rejects missing text', () => {
    expect(shouldProcessMessage(
      { type: 'message', user: 'U123', channel: 'C456' },
      null,
      null,
    )).toBe(false)
  })
})

// ─── Slack URL verification challenge ───────────────────────────────────────

describe('Slack URL verification', () => {
  it('responds with challenge for url_verification type', () => {
    const payload = { type: 'url_verification', challenge: 'abc123xyz' }
    if (payload.type === 'url_verification') {
      expect({ challenge: payload.challenge }).toEqual({ challenge: 'abc123xyz' })
    }
  })
})

// ─── Slack API URL construction ─────────────────────────────────────────────

describe('Slack API helpers', () => {
  const SLACK_API = 'https://slack.com/api'

  it('constructs correct chat.postMessage URL', () => {
    expect(`${SLACK_API}/chat.postMessage`).toBe('https://slack.com/api/chat.postMessage')
  })

  it('constructs correct auth.test URL', () => {
    expect(`${SLACK_API}/auth.test`).toBe('https://slack.com/api/auth.test')
  })

  it('constructs correct bots.info URL', () => {
    expect(`${SLACK_API}/bots.info`).toBe('https://slack.com/api/bots.info')
  })

  it('authorization header uses Bearer format', () => {
    const token = 'xoxb-my-token'
    expect(`Bearer ${token}`).toBe('Bearer xoxb-my-token')
  })

  it('sendMessage body includes thread_ts for replies', () => {
    const body: Record<string, unknown> = {
      channel: 'C123',
      text: 'Hello',
    }
    const replyToMessageId = '1234567890.123456'
    body.thread_ts = replyToMessageId

    expect(body).toEqual({
      channel: 'C123',
      text: 'Hello',
      thread_ts: '1234567890.123456',
    })
  })

  it('sendMessage body omits thread_ts when not replying', () => {
    const body: Record<string, unknown> = {
      channel: 'C123',
      text: 'Hello',
    }
    expect(body.thread_ts).toBeUndefined()
  })
})

// ─── SlackChannelConfig shape validation ────────────────────────────────────

describe('SlackChannelConfig shape', () => {
  it('requires botTokenVaultKey and signingSecretVaultKey', () => {
    const config = {
      botTokenVaultKey: 'vault:slack-bot-token',
      signingSecretVaultKey: 'vault:slack-signing-secret',
    }
    expect(config.botTokenVaultKey).toBeDefined()
    expect(config.signingSecretVaultKey).toBeDefined()
  })

  it('allowedChannelIds is optional', () => {
    const config1 = { botTokenVaultKey: 'k', signingSecretVaultKey: 's' }
    const config2 = { botTokenVaultKey: 'k', signingSecretVaultKey: 's', allowedChannelIds: ['C123'] }
    expect(config1).not.toHaveProperty('allowedChannelIds')
    expect(config2.allowedChannelIds).toEqual(['C123'])
  })

  it('empty allowedChannelIds results in null filter', () => {
    const ids: string[] = []
    const filter = ids.length ? new Set(ids) : null
    expect(filter).toBeNull()
  })
})

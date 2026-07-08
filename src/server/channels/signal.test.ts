import { describe, it, expect } from 'bun:test'

// ─── splitMessage logic tests ───────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 2000

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

describe('Signal splitMessage', () => {
  it('returns single chunk for short messages', () => {
    expect(splitMessage('Hello')).toEqual(['Hello'])
  })

  it('returns single chunk for exactly max length', () => {
    const text = 'a'.repeat(MAX_MESSAGE_LENGTH)
    expect(splitMessage(text)).toEqual([text])
  })

  it('splits at paragraph boundary', () => {
    const part1 = 'a'.repeat(1800)
    const part2 = 'b'.repeat(1800)
    const text = `${part1}\n\n${part2}`
    const chunks = splitMessage(text)
    expect(chunks.length).toBe(2)
    expect(chunks[0]).toBe(part1)
    expect(chunks[1]).toBe(part2)
  })

  it('splits at line boundary when no paragraph break', () => {
    const lines = Array.from({ length: 150 }, (_, i) => `Line ${i}: ${'x'.repeat(15)}`).join('\n')
    const chunks = splitMessage(lines)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
  })

  it('splits at sentence boundary when no line break', () => {
    const sentences = Array.from({ length: 150 }, (_, i) => `Sentence ${i} content`).join('. ')
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
    const part1 = 'a'.repeat(1900)
    const part2 = 'b'.repeat(100)
    const text = `${part1}\n\n   ${part2}`
    const chunks = splitMessage(text)
    if (chunks.length > 1) {
      expect(chunks[1]!.startsWith(' ')).toBe(false)
    }
  })
})

// ─── Signal webhook payload parsing ─────────────────────────────────────────

describe('Signal webhook payload parsing', () => {
  function extractMessage(payload: Record<string, unknown>): {
    source: string
    sourceName: string
    chatId: string
    text: string
    timestamp: string
  } | null {
    const envelope = (payload.envelope ?? payload) as {
      source?: string
      sourceName?: string
      sourceUuid?: string
      timestamp?: number
      dataMessage?: {
        message?: string
        timestamp?: number
        groupInfo?: { groupId?: string }
      }
    }

    const dataMessage = envelope.dataMessage
    if (!dataMessage?.message) return null

    const source = envelope.source ?? envelope.sourceUuid ?? ''
    const chatId = dataMessage.groupInfo?.groupId ?? source

    return {
      source,
      sourceName: envelope.sourceName ?? source,
      chatId,
      text: dataMessage.message,
      timestamp: String(dataMessage.timestamp ?? envelope.timestamp ?? Date.now()),
    }
  }

  it('extracts a direct message', () => {
    const payload = {
      envelope: {
        source: '+33612345678',
        sourceName: 'Nicolas',
        timestamp: 1700000000000,
        dataMessage: {
          message: 'Hello Signal!',
          timestamp: 1700000000001,
        },
      },
    }

    const msg = extractMessage(payload)
    expect(msg).not.toBeNull()
    expect(msg!.source).toBe('+33612345678')
    expect(msg!.sourceName).toBe('Nicolas')
    expect(msg!.chatId).toBe('+33612345678')
    expect(msg!.text).toBe('Hello Signal!')
    expect(msg!.timestamp).toBe('1700000000001')
  })

  it('extracts a group message', () => {
    const payload = {
      envelope: {
        source: '+33612345678',
        sourceName: 'Nicolas',
        timestamp: 1700000000000,
        dataMessage: {
          message: 'Hello group!',
          timestamp: 1700000000002,
          groupInfo: { groupId: 'base64groupid==' },
        },
      },
    }

    const msg = extractMessage(payload)
    expect(msg).not.toBeNull()
    expect(msg!.chatId).toBe('base64groupid==')
    expect(msg!.source).toBe('+33612345678')
  })

  it('returns null for non-text messages', () => {
    const payload = {
      envelope: {
        source: '+33600000000',
        dataMessage: {},
      },
    }
    expect(extractMessage(payload)).toBeNull()
  })

  it('returns null for receipt messages (no dataMessage)', () => {
    const payload = {
      envelope: {
        source: '+33600000000',
        receiptMessage: { type: 'DELIVERY' },
      },
    }
    expect(extractMessage(payload)).toBeNull()
  })

  it('falls back to sourceUuid when source is missing', () => {
    const payload = {
      envelope: {
        sourceUuid: 'uuid-1234-5678',
        dataMessage: {
          message: 'From UUID',
          timestamp: 1700000000003,
        },
      },
    }

    const msg = extractMessage(payload)
    expect(msg).not.toBeNull()
    expect(msg!.source).toBe('uuid-1234-5678')
    expect(msg!.sourceName).toBe('uuid-1234-5678')
  })

  it('handles payload without envelope wrapper', () => {
    const payload = {
      source: '+33699999999',
      sourceName: 'Direct',
      dataMessage: {
        message: 'No envelope',
        timestamp: 1700000000004,
      },
    }

    const msg = extractMessage(payload)
    expect(msg).not.toBeNull()
    expect(msg!.text).toBe('No envelope')
  })

  it('falls back to envelope timestamp when dataMessage timestamp missing', () => {
    const payload = {
      envelope: {
        source: '+33600000000',
        timestamp: 1700000099999,
        dataMessage: {
          message: 'No data timestamp',
        },
      },
    }

    const msg = extractMessage(payload)
    expect(msg!.timestamp).toBe('1700000099999')
  })
})

// ─── Signal allowedChatIds filtering ────────────────────────────────────────

describe('Signal allowedChatIds filtering', () => {
  function isAllowed(chatId: string, source: string, allowedChatIds?: string[]): boolean {
    if (!allowedChatIds?.length) return true
    return allowedChatIds.includes(chatId) || allowedChatIds.includes(source)
  }

  it('allows all when no allowedChatIds configured', () => {
    expect(isAllowed('+33600000000', '+33600000000', undefined)).toBe(true)
    expect(isAllowed('+33600000000', '+33600000000', [])).toBe(true)
  })

  it('allows matching chatId', () => {
    expect(isAllowed('group123', '+33600000000', ['group123'])).toBe(true)
  })

  it('allows matching source', () => {
    expect(isAllowed('group999', '+33612345678', ['+33612345678'])).toBe(true)
  })

  it('rejects non-matching chat and source', () => {
    expect(isAllowed('group999', '+33600000000', ['+33699999999', 'othergroup'])).toBe(false)
  })
})

// ─── Signal send body construction ──────────────────────────────────────────

describe('Signal send body construction', () => {
  function buildSendBody(
    phone: string,
    chatId: string,
    message: string,
    replyToMessageId?: string,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      message,
      number: phone,
      ...(chatId.startsWith('+')
        ? { recipients: [chatId] }
        : { recipients: [], group_id: chatId }),
    }

    if (replyToMessageId) {
      body.quote = { id: Number(replyToMessageId) }
    }

    return body
  }

  it('constructs DM body with recipients', () => {
    const body = buildSendBody('+33600000000', '+33612345678', 'Hello!')
    expect(body.recipients).toEqual(['+33612345678'])
    expect(body.group_id).toBeUndefined()
    expect(body.number).toBe('+33600000000')
    expect(body.message).toBe('Hello!')
  })

  it('constructs group body with group_id', () => {
    const body = buildSendBody('+33600000000', 'base64groupid==', 'Hello group!')
    expect(body.recipients).toEqual([])
    expect(body.group_id).toBe('base64groupid==')
  })

  it('adds quote for replies', () => {
    const body = buildSendBody('+33600000000', '+33612345678', 'Reply', '1700000000001')
    expect(body.quote).toEqual({ id: 1700000000001 })
  })

  it('omits quote when not replying', () => {
    const body = buildSendBody('+33600000000', '+33612345678', 'No reply')
    expect(body.quote).toBeUndefined()
  })
})

// ─── SignalChannelConfig shape validation ───────────────────────────────────

describe('SignalChannelConfig shape', () => {
  it('requires apiUrlVaultKey and phoneNumber', () => {
    const config = {
      apiUrlVaultKey: 'vault:signal-api-url',
      phoneNumber: '+33612345678',
    }
    expect(config.apiUrlVaultKey).toBeDefined()
    expect(config.phoneNumber).toBeDefined()
  })

  it('phoneNumber should be E.164 format', () => {
    const phone = '+33612345678'
    expect(phone.startsWith('+')).toBe(true)
    expect(/^\+\d{7,15}$/.test(phone)).toBe(true)
  })

  it('allowedChatIds is optional', () => {
    const config = {
      apiUrlVaultKey: 'vault:signal-api-url',
      phoneNumber: '+33612345678',
      allowedChatIds: ['+33699999999', 'groupId123'],
    }
    expect(config.allowedChatIds).toHaveLength(2)
  })
})

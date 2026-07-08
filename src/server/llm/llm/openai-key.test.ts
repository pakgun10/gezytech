import { describe, expect, it } from 'bun:test'
import { inferContextWindow, inferThinking, isChatModel } from './openai-key'

// ─── inferThinking ───────────────────────────────────────────────────────────

describe('inferThinking', () => {
  it('returns undefined for non-reasoning families', () => {
    expect(inferThinking('gpt-4o')).toBeUndefined()
    expect(inferThinking('gpt-4o-mini')).toBeUndefined()
    expect(inferThinking('gpt-3.5-turbo')).toBeUndefined()
    expect(inferThinking('chatgpt-4o-latest')).toBeUndefined()
  })

  it('detects o-series reasoning models', () => {
    expect(inferThinking('o1')!.efforts).toEqual(['low', 'medium', 'high'])
    expect(inferThinking('o1-mini')!.efforts).toEqual(['low', 'medium', 'high'])
    expect(inferThinking('o3-mini')!.efforts).toEqual(['low', 'medium', 'high'])
    expect(inferThinking('o4-mini')!.efforts).toEqual(['low', 'medium', 'high'])
    // Future-proofing: o5, o6, etc. should still match
    expect(inferThinking('o5-preview')!.efforts).toEqual(['low', 'medium', 'high'])
  })

  it('detects gpt-5 family as reasoning', () => {
    expect(inferThinking('gpt-5')!.efforts).toEqual(['low', 'medium', 'high'])
    expect(inferThinking('gpt-5-mini')!.efforts).toEqual(['low', 'medium', 'high'])
    expect(inferThinking('gpt-5.1')!.efforts).toEqual(['low', 'medium', 'high'])
    expect(inferThinking('gpt-5.5-codex')!.efforts).toEqual(['low', 'medium', 'high'])
  })

  it('never reports a `max` effort (OpenAI caps at `high`)', () => {
    const t = inferThinking('o1')!
    expect(t.efforts).not.toContain('max')
  })
})

// ─── inferContextWindow ──────────────────────────────────────────────────────

describe('inferContextWindow', () => {
  it('maps known families to documented context windows', () => {
    expect(inferContextWindow('gpt-5')).toBe(256_000)
    expect(inferContextWindow('gpt-5-mini')).toBe(256_000)
    expect(inferContextWindow('gpt-4.1-2025-04-14')).toBe(1_000_000)
    expect(inferContextWindow('gpt-4o')).toBe(128_000)
    expect(inferContextWindow('gpt-4o-mini')).toBe(128_000)
    expect(inferContextWindow('gpt-4-turbo')).toBe(128_000)
    expect(inferContextWindow('gpt-4')).toBe(8_192)
    expect(inferContextWindow('gpt-3.5-turbo')).toBe(16_385)
    expect(inferContextWindow('o1-mini')).toBe(200_000)
    expect(inferContextWindow('o3-mini')).toBe(200_000)
  })

  it('falls back to 128k for unknown model IDs', () => {
    expect(inferContextWindow('unknown-model')).toBe(128_000)
    expect(inferContextWindow('')).toBe(128_000)
    expect(inferContextWindow('some-future-model')).toBe(128_000)
  })

  it('prefers more specific prefixes over more general ones', () => {
    // gpt-4-turbo must hit the turbo rule (128k), not the bare gpt-4 rule (8k).
    expect(inferContextWindow('gpt-4-turbo-2024-04-09')).toBe(128_000)
    // gpt-4.1 must hit the .1 rule (1M), not the bare gpt-4 rule (8k).
    expect(inferContextWindow('gpt-4.1-mini')).toBe(1_000_000)
  })
})

// ─── isChatModel ─────────────────────────────────────────────────────────────

describe('isChatModel', () => {
  it('accepts chat-capable families', () => {
    expect(isChatModel('gpt-4o')).toBe(true)
    expect(isChatModel('gpt-4o-mini')).toBe(true)
    expect(isChatModel('gpt-3.5-turbo')).toBe(true)
    expect(isChatModel('chatgpt-4o-latest')).toBe(true)
    expect(isChatModel('o1')).toBe(true)
    expect(isChatModel('o3-mini')).toBe(true)
    expect(isChatModel('gpt-5')).toBe(true)
  })

  it('rejects embedding models', () => {
    expect(isChatModel('text-embedding-3-small')).toBe(false)
    expect(isChatModel('text-embedding-3-large')).toBe(false)
    expect(isChatModel('text-embedding-ada-002')).toBe(false)
  })

  it('rejects audio / image / moderation / fine-tune families', () => {
    expect(isChatModel('tts-1')).toBe(false)
    expect(isChatModel('whisper-1')).toBe(false)
    expect(isChatModel('dall-e-3')).toBe(false)
    expect(isChatModel('gpt-image-1')).toBe(false)
    expect(isChatModel('omni-moderation-latest')).toBe(false)
    expect(isChatModel('text-moderation-007')).toBe(false)
    expect(isChatModel('davinci-002')).toBe(false)
    expect(isChatModel('babbage-002')).toBe(false)
    expect(isChatModel('ft:gpt-4o:my-org:custom:abc123')).toBe(false)
  })

  it('rejects audio/realtime variants of otherwise-chat families', () => {
    expect(isChatModel('gpt-4o-realtime-preview')).toBe(false)
    expect(isChatModel('gpt-4o-audio-preview')).toBe(false)
  })

  it('rejects arbitrary unknown model ids', () => {
    expect(isChatModel('unknown-model')).toBe(false)
    expect(isChatModel('llama-3')).toBe(false)
    expect(isChatModel('')).toBe(false)
  })
})

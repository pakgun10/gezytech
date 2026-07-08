import { describe, expect, it } from 'bun:test'
import { mapModel, type OpenAICompatibleEmbeddingModel } from './openai-compatible'

// A generic /v1/models payload exposes only ids; embedding endpoints (Ollama,
// llama.cpp, …) do not follow OpenAI's `text-embedding-*` naming.

describe('mapModel', () => {
  it('maps an arbitrary embedding id with no name filter and no hardcoded dimensions', () => {
    const m = mapModel({ id: 'qwen3-embedding:0.6b', object: 'model' })!
    expect(m.id).toBe('qwen3-embedding:0.6b')
    expect(m.name).toBe('qwen3-embedding:0.6b')
    // Dimensions are inferred by the host from the first embed call.
    expect(m.dimensions).toBeUndefined()
    expect(m.maxInputTokens).toBeUndefined()
  })

  it('does NOT restrict to the text-embedding-* naming pattern', () => {
    for (const id of ['nomic-embed-text', 'embeddinggemma', 'mxbai-embed-large']) {
      expect(mapModel({ id })?.id).toBe(id)
    }
  })

  it('returns null for entries without an id', () => {
    expect(mapModel({ id: '' })).toBeNull()
  })
})

describe('listModels payload shape', () => {
  // listModels reads `payload.data` from the OpenAI-style `{data:[{id}]}`
  // response and maps every entry verbatim (dropping id-less ones).
  it('maps every model in a {data:[{id}]} listing, dropping id-less entries', () => {
    const payload: { object: string; data: OpenAICompatibleEmbeddingModel[] } = {
      object: 'list',
      data: [{ id: 'nomic-embed-text' }, { id: 'qwen3-embedding:0.6b' }, { id: '' }],
    }
    const mapped = payload.data.map(mapModel).filter((m): m is NonNullable<typeof m> => m !== null)
    expect(mapped.map((m) => m.id)).toEqual(['nomic-embed-text', 'qwen3-embedding:0.6b'])
  })
})

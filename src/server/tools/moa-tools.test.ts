import { describe, it, expect } from 'bun:test'
import {
  normalizeStrategy,
  clampMaxModels,
  variationTemperatures,
  buildMessages,
  buildCandidateSystem,
  buildSynthesizerRequest,
  buildDebateCritiquePrompt,
  buildVoteExtractionPrompt,
  extractVoteAnswer,
  tallyVotes,
  formatMoarResult,
  type CandidateResult,
} from '@/server/tools/moa-tools'

describe('normalizeStrategy', () => {
  it('defaults to parallel when undefined/empty', () => {
    expect(normalizeStrategy(undefined)).toBe('parallel')
    expect(normalizeStrategy('' as unknown as string)).toBe('parallel')
  })
  it('returns debate/vote as their own strategies', () => {
    expect(normalizeStrategy('debate')).toBe('debate')
    expect(normalizeStrategy('VOTE')).toBe('vote')
    expect(normalizeStrategy('vote')).toBe('vote')
  })
  it('is case-insensitive and clamps unknown values to parallel', () => {
    expect(normalizeStrategy('PARALLEL')).toBe('parallel')
    expect(normalizeStrategy('something-else')).toBe('parallel')
  })
})

describe('clampMaxModels', () => {
  it('uses the default (3) when requested is non-positive or undefined, bounded by max', () => {
    expect(clampMaxModels(undefined, 8)).toBe(3)
    expect(clampMaxModels(0, 8)).toBe(3)
    expect(clampMaxModels(-5, 8)).toBe(3)
  })
  it('respects the max cap when default would exceed it', () => {
    expect(clampMaxModels(undefined, 2)).toBe(2)
  })
  it('clamps requested into [1, max]', () => {
    expect(clampMaxModels(1, 8)).toBe(1)
    expect(clampMaxModels(5, 8)).toBe(5)
    expect(clampMaxModels(100, 8)).toBe(8)
    expect(clampMaxModels(2.9, 8)).toBe(2) // floors
  })
})

describe('variationTemperatures', () => {
  it('returns n values within a safe band [0, 1.5]', () => {
    const temps = variationTemperatures(4)
    expect(temps).toHaveLength(4)
    for (const t of temps) {
      expect(t).toBeGreaterThanOrEqual(0)
      expect(t).toBeLessThanOrEqual(1.5)
    }
  })
  it('is deterministic per n (same input -> same output)', () => {
    expect(variationTemperatures(5)).toEqual(variationTemperatures(5))
  })
  it('produces distinct values for the first few', () => {
    const temps = variationTemperatures(6)
    expect(new Set(temps).size).toBeGreaterThan(1)
  })
  it('cycles when n exceeds the band length', () => {
    const temps = variationTemperatures(7)
    expect(temps).toHaveLength(7)
    expect(temps[0]).toBe(temps[6])
  })
})

describe('buildMessages', () => {
  it('wraps the prompt as a single user text turn', () => {
    const msgs = buildMessages('hello world')
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.role).toBe('user')
    const part = (msgs[0]!.content as Array<{ type: string; text: string }>)[0]!
    expect(part.type).toBe('text')
    expect(part.text).toBe('hello world')
  })
})

describe('buildCandidateSystem', () => {
  it('returns a one-block system prompt mentioning the strategy', () => {
    const sys = buildCandidateSystem('parallel')
    expect(sys).toHaveLength(1)
    expect(sys[0]!.type).toBe('text')
    expect(sys[0]!.text).toContain('Mixture of Agents')
    expect(sys[0]!.text).toContain('parallel')
  })
})

describe('buildSynthesizerRequest', () => {
  it('includes the original prompt and labeled candidate answers', () => {
    const candidates: CandidateResult[] = [
      { model: 'm1', providerId: 'p1', text: 'answer one' },
      { model: 'm2', text: 'answer two' },
    ]
    const { system, messages } = buildSynthesizerRequest('what is X?', candidates, 'parallel')
    expect(system).toHaveLength(1)
    expect(system[0]!.text).toContain('synthesizer')
    const userText = (messages[0]!.content as Array<{ type: string; text: string }>)[0]!.text
    expect(userText).toContain('## Original user prompt')
    expect(userText).toContain('what is X?')
    expect(userText).toContain('Candidate 1')
    expect(userText).toContain('answer one')
    expect(userText).toContain('model: m1')
    expect(userText).toContain('answer two')
    expect(userText).toContain('Your task')
  })
  it('flags failed candidates distinctly', () => {
    const candidates: CandidateResult[] = [
      { model: 'm1', text: '', error: 'timeout' },
    ]
    const { messages } = buildSynthesizerRequest('q', candidates, 'parallel')
    const userText = (messages[0]!.content as Array<{ type: string; text: string }>)[0]!.text
    expect(userText).toContain('[FAILED: timeout]')
  })
})

describe('formatMoarResult', () => {
  it('reports success when final is non-empty and at least one candidate succeeded', () => {
    const candidates: CandidateResult[] = [
      { model: 'm1', text: 'a' },
      { model: 'm2', text: 'b' },
    ]
    const r = formatMoarResult('final answer', candidates, 'parallel', 'q')
    expect(r.success).toBe(true)
    expect(r.finalAnswer).toBe('final answer')
    expect(r.strategy).toBe('parallel')
    expect(r.candidateCount).toBe(2)
    expect(r.succeededCandidates).toBe(2)
    expect(r.candidates[0]).toMatchObject({ model: 'm1', ok: true })
    expect(r.originalPrompt).toBe('q')
  })
  it('reports failure when every candidate errored', () => {
    const candidates: CandidateResult[] = [
      { model: 'm1', text: '', error: 'timeout' },
    ]
    const r = formatMoarResult('', candidates, 'parallel', 'q')
    expect(r.success).toBe(false)
    expect(r.succeededCandidates).toBe(0)
    expect(r.candidates[0]!.ok).toBe(false)
    expect(r.candidates[0]!.error).toBe('timeout')
  })
  it('reports failure when final answer is empty despite successful candidates', () => {
    const candidates: CandidateResult[] = [{ model: 'm1', text: 'a' }]
    const r = formatMoarResult('   ', candidates, 'parallel', 'q')
    expect(r.success).toBe(false)
  })
  it('truncates candidate previews to ~240 chars', () => {
    const long = 'x'.repeat(1000)
    const candidates: CandidateResult[] = [{ model: 'm1', text: long }]
    const r = formatMoarResult('out', candidates, 'parallel', 'q')
    expect(r.candidates[0]!.preview.length).toBe(240)
  })
})

describe('buildDebateCritiquePrompt', () => {
  it('includes original prompt, own answer, and other candidates', () => {
    const msgs = buildDebateCritiquePrompt(
      'what is 2+2?',
      '4',
      [{ model: 'm2', text: '5' }],
    )
    const text = (msgs[0]!.content as Array<{ type: string; text: string }>)[0]!.text
    expect(text).toContain('what is 2+2?')
    expect(text).toContain('Your initial answer')
    expect(text).toContain('4')
    expect(text).toContain('Other candidate')
    expect(text).toContain('5')
    expect(text).toContain('REVISED')
  })
})

describe('buildVoteExtractionPrompt', () => {
  it('asks for a concise answer', () => {
    const msgs = buildVoteExtractionPrompt('capital of France?')
    const text = (msgs[0]!.content as Array<{ type: string; text: string }>)[0]!.text
    expect(text).toContain('capital of France?')
    expect(text).toContain('concisely')
    expect(text).toContain('ONLY')
  })
})

describe('extractVoteAnswer', () => {
  it('extracts the last non-empty line', () => {
    expect(extractVoteAnswer('some reasoning\nthe answer is 42')).toBe('the answer is 42')
  })
  it('strips markdown formatting', () => {
    expect(extractVoteAnswer('**Paris**')).toBe('paris')
    expect(extractVoteAnswer('`tokyo`')).toBe('tokyo')
  })
  it('handles single-line answers', () => {
    expect(extractVoteAnswer('yes')).toBe('yes')
  })
})

describe('tallyVotes', () => {
  it('returns the majority answer', () => {
    const { winner, votes } = tallyVotes(['paris', 'paris', 'london'])
    expect(winner).toBe('paris')
    expect(votes['paris']).toBe(2)
    expect(votes['london']).toBe(1)
  })
  it('handles unanimous votes', () => {
    const { winner } = tallyVotes(['tokyo', 'tokyo', 'tokyo'])
    expect(winner).toBe('tokyo')
  })
  it('handles single vote', () => {
    const { winner } = tallyVotes(['berlin'])
    expect(winner).toBe('berlin')
  })
  it('handles tie by picking first encountered', () => {
    const { winner } = tallyVotes(['a', 'b'])
    expect(['a', 'b']).toContain(winner)
  })
})

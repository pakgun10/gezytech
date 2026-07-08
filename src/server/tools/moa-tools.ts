/**
 * `moa` — Mixture of Agents.
 *
 * Orchestrate multiple model calls in parallel and produce a single synthesized
 * answer. Even with the same base model, running it several times with varied
 * temperature / prompt variations + a synthesizer pass catches hallucinations
 * (ensemble effect) and yields a more stable answer than a single shot — the
 * capability that makes `gezyhd` feel more reliable on hard questions.
 *
 * Phase 1+2:
 *   - strategy `parallel` only. `debate` / `vote` are accepted for API
 *     stability but fall back to `parallel` (see I-31).
 *   - no recursive tool-calling: the candidate + synthesizer turns are issued
 *     WITHOUT `tools`, so `moa` never re-enters Hivekeep's tool loop.
 *   - default model set = the calling Agent's own model (resolved from
 *     `agentId` via `getAgentDetails`). Caller may pass an explicit `models[]`
 *     of model IDs (provider resolved via `resolveLLM`).
 *
 * Security/cost surface:
 *   - read-only (only LLM calls; no host state mutation) → `readOnly: true`.
 *   - NOT concurrency-safe (a single `moa` already fires N+1 LLM calls) →
 *     `concurrencySafe: false`.
 *   - bounded by `maxModels` (default 3) and per-call timeouts
 *     (`GEZY_MOA_TIMEOUT_MS`, default 60s) to keep blast radius small.
 *
 * The pure helpers (`clampMaxModels`, `variationTemperatures`, `buildMessages`,
 * `buildSynthesizerRequest`, `formatMoarResult`, `normalizeStrategy`) are
 * exported without heavy deps so they can be unit-tested directly. The LLM
 * plumbing (`resolveLLM`, `getAgentDetails`) is imported lazily inside
 * `execute` so the module top stays import-light for tests.
 */
import { z } from 'zod'
import { tool } from '@/server/tools/tool-helper'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'
import type {
  ChatChunk,
  HivekeepMessage,
  LLMModel,
  LLMProvider,
  SystemPrompt,
} from '@/server/llm/llm/types'
import type { ProviderConfig, Usage } from '@gezy/sdk'

const log = createLogger('moa-tool')

const MAX_MODELS_DEFAULT =
  Number(process.env.GEZY_MOA_MAX_MODELS ?? 0) > 0
    ? Number(process.env.GEZY_MOA_MAX_MODELS)
    : 3
const PER_CALL_TIMEOUT_MS =
  Number(process.env.GEZY_MOA_TIMEOUT_MS ?? 0) > 0
    ? Number(process.env.GEZY_MOA_TIMEOUT_MS)
    : 60_000
const CANDIDATE_MAX_OUTPUT_TOKENS =
  Number(process.env.GEZY_MOA_CANDIDATE_MAX_TOKENS ?? 0) > 0
    ? Number(process.env.GEZY_MOA_CANDIDATE_MAX_TOKENS)
    : 4096
const SYNTHESIZER_MAX_OUTPUT_TOKENS =
  Number(process.env.GEZY_MOA_SYNTH_MAX_TOKENS ?? 0) > 0
    ? Number(process.env.GEZY_MOA_SYNTH_MAX_TOKENS)
    : 8192

/** A candidate's accumulated run. */
export interface CandidateResult {
  model: string
  /** Provider id (slug or UUID) used to resolve the model, when known. */
  providerId?: string
  /** The candidate's full text answer, or empty when it errored. */
  text: string
  /** Error message when the candidate failed (timeout / API error / no provider). */
  error?: string
  /** Provider-reported usage for this candidate, when the stream finished. */
  usage?: Usage
}

/** Deterministic strategy normalization. */
export type MoaStrategy = 'parallel' | 'debate' | 'vote'
export function normalizeStrategy(strategy: string | undefined): MoaStrategy {
  const s = (strategy ?? 'parallel').toLowerCase()
  if (s === 'debate') return 'debate'
  if (s === 'vote') return 'vote'
  return 'parallel'
}

/** Clamp the requested candidate count to [1, max]. Non-positive → default. */
export function clampMaxModels(requested: number | undefined, max: number): number {
  const r = requested ?? 0
  if (!Number.isFinite(r) || r <= 0) return Math.min(MAX_MODELS_DEFAULT, max)
  return Math.max(1, Math.min(Math.floor(r), max))
}

/**
 * Produce `n` distinct temperature values for ensemble variation when the
 * caller reuses the same model. Kept inside a safe [0, 1.5] band so providers
 * that reject out-of-range temperatures don't 400. Deterministic so tests are
 * stable and the payload is reproducible per call.
 */
export function variationTemperatures(n: number): number[] {
  const band = [0.2, 0.7, 0.5, 0.9, 0.35, 0.6]
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(band[i % band.length]!)
  return out
}

/** Build the `messages` array for a candidate turn: a single user text turn. */
export function buildMessages(prompt: string): HivekeepMessage[] {
  return [
    {
      role: 'user',
      content: [{ type: 'text', text: prompt }],
    },
  ]
}

/** Build the system prompt blocks handed to every candidate run. */
export function buildCandidateSystem(strategy: MoaStrategy): SystemPrompt {
  return [
    {
      type: 'text',
      text:
        'You are one of several AI models being consulted in parallel (Mixture of Agents, ' +
        `${strategy} strategy). Answer the user prompt directly and completely. Do not mention ` +
        'this orchestration setup, the other models, or that you are part of an ensemble.',
    },
  ]
}

/**
 * Build the synthesizer request (system + user) that combines the candidates
 * into a single answer. Pure — takes the candidates as data and returns the
 * request pieces, so it can be unit-tested without any LLM call.
 */
export function buildSynthesizerRequest(
  originalPrompt: string,
  candidates: CandidateResult[],
  strategy: MoaStrategy,
): { system: SystemPrompt; messages: HivekeepMessage[] } {
  const system: SystemPrompt = [
    {
      type: 'text',
      text:
        'You are a synthesizer model in a Mixture of Agents ensemble. You are given the ' +
        `original user prompt and the answers from ${candidates.length} candidate model ` +
        `run(s) (${strategy} strategy). Produce a single, coherent final answer to the ` +
        'original prompt. Prefer information the candidates agree on; treat unique claims ' +
        'with skepticism; note conflicts only if material. Do not invent information absent ' +
        'from all candidates. Output ONLY the final answer.',
    },
  ]
  const parts = candidates
    .map((c, i) => {
      const body = c.error ? `[FAILED: ${c.error}]` : c.text
      return `### Candidate ${i + 1} — model: ${c.model}\n${body}`
    })
    .join('\n\n')
  const userText =
    `## Original user prompt\n${originalPrompt}\n\n` +
    `## Candidate answers\n${parts}\n\n` +
    '## Your task\nWrite the single best final answer to the original prompt.'
  const messages: HivekeepMessage[] = [
    { role: 'user', content: [{ type: 'text', text: userText }] },
  ]
  return { system, messages }
}

/** Build a critique prompt for the debate strategy. Each candidate sees
 *  the other candidates' answers and is asked to critique + revise. Pure. */
export function buildDebateCritiquePrompt(
  originalPrompt: string,
  myAnswer: string,
  otherAnswers: Array<{ model: string; text: string }>,
): HivekeepMessage[] {
  const othersText = otherAnswers
    .map((o, i) => `### Other candidate ${i + 1} (${o.model})\n${o.text}`)
    .join('\n\n')
  const userText =
    `## Original prompt\n${originalPrompt}\n\n` +
    `## Your initial answer\n${myAnswer}\n\n` +
    `## Other candidates' answers\n${othersText}\n\n` +
    `## Your task\nCritique the other candidates' answers and your own. ` +
    `Identify errors, gaps, and strengths. Then provide your REVISED answer. ` +
    `Output ONLY your revised answer.`
  return [{ role: 'user', content: [{ type: 'text', text: userText }] }]
}

/** Build a vote extraction prompt — ask the model to give a SHORT answer. Pure. */
export function buildVoteExtractionPrompt(originalPrompt: string): HivekeepMessage[] {
  const userText =
    `## Question\n${originalPrompt}\n\n` +
    `## Your task\nAnswer the question as concisely as possible — ideally one word or a short phrase. ` +
    `Output ONLY the answer, nothing else.`
  return [{ role: 'user', content: [{ type: 'text', text: userText }] }]
}

/** Extract a short answer from a candidate's text for voting. Pure. */
export function extractVoteAnswer(text: string): string {
  // Take the last non-empty line (often the final answer after reasoning)
  const lines = text.trim().split('\n').filter((l) => l.trim().length > 0)
  const last = lines[lines.length - 1]?.trim() ?? text.trim()
  // Strip markdown formatting
  return last.replace(/[*_`#>]/g, '').trim().toLowerCase()
}

/** Tally votes and return the majority answer. Pure. */
export function tallyVotes(answers: string[]): { winner: string; votes: Record<string, number> } {
  const votes: Record<string, number> = {}
  for (const a of answers) {
    const key = a.slice(0, 100) // normalize length
    votes[key] = (votes[key] ?? 0) + 1
  }
  let winner = answers[0] ?? ''
  let maxVotes = 0
  for (const [answer, count] of Object.entries(votes)) {
    if (count > maxVotes) {
      maxVotes = count
      winner = answer
    }
  }
  return { winner, votes }
}

/** Format the final tool result object (returned to the LLM as JSON). */
export function formatMoarResult(
  final: string,
  candidates: CandidateResult[],
  strategy: MoaStrategy,
  originalPrompt: string,
): {
  success: boolean
  finalAnswer: string
  strategy: MoaStrategy
  candidateCount: number
  succeededCandidates: number
  candidates: Array<{
    model: string
    providerId?: string
    ok: boolean
    error?: string
    preview: string
  }>
  originalPrompt: string
} {
  const succeeded = candidates.filter((c) => !c.error).length
  return {
    success: succeeded > 0 && final.trim().length > 0,
    finalAnswer: final,
    strategy,
    candidateCount: candidates.length,
    succeededCandidates: succeeded,
    candidates: candidates.map((c) => ({
      model: c.model,
      providerId: c.providerId,
      ok: !c.error,
      error: c.error,
      preview: c.text.slice(0, 240),
    })),
    originalPrompt,
  }
}

// ─── LLM plumbing (kept out of the pure helpers above) ──────────────────────

/** Consume one provider chat stream into `{ text, usage }`. Never throws. */
async function consumeStream(
  stream: AsyncIterable<ChatChunk>,
  signal: AbortSignal,
): Promise<{ text: string; usage?: Usage }> {
  let text = ''
  let usage: Usage | undefined
  for await (const chunk of stream) {
    if (signal.aborted) break
    if (chunk.type === 'text-delta') {
      text += chunk.text
    } else if (chunk.type === 'finish') {
      usage = chunk.usage
    }
    // tool-use / thinking-* are ignored — MoA never re-enters the tool loop.
  }
  return { text, usage }
}

/** Resolve a model id to a provider/model/config triple, lazily. */
async function resolveModel(modelId: string, providerId?: string): Promise<{
  provider: LLMProvider
  model: LLMModel
  config: ProviderConfig
} | { error: string }> {
  try {
    const { resolveLLM } = await import('@/server/llm/core/resolve')
    const resolved = await resolveLLM({ modelId, providerId })
    return {
      provider: resolved.provider,
      model: resolved.model,
      config: resolved.config,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn({ modelId, providerId, err: msg }, 'moa: failed to resolve model')
    return { error: msg }
  }
}

/** Resolve the calling Agent's own model as the default model set, lazily. */
async function resolveAgentDefaultModel(agentId: string): Promise<
  { modelId: string; providerId?: string } | { error: string }
> {
  try {
    const { getAgentDetails } = await import('@/server/services/agents')
    const agent = await getAgentDetails(agentId)
    if (!agent || !agent.model) return { error: 'agent has no model configured' }
    return { modelId: agent.model, providerId: agent.providerId ?? undefined }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: msg }
  }
}

/** Run a single candidate with a timeout-bounded abort, never throws. */
async function runCandidate(
  modelId: string,
  providerId: string | undefined,
  prompt: string,
  temperature: number,
): Promise<CandidateResult> {
  const resolved = await resolveModel(modelId, providerId)
  if ('error' in resolved) {
    return { model: modelId, providerId, text: '', error: resolved.error }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS)
  try {
    const stream = resolved.provider.chat(
      resolved.model,
      {
        messages: buildMessages(prompt),
        system: buildCandidateSystem('parallel'),
        temperature,
        maxOutputTokens: CANDIDATE_MAX_OUTPUT_TOKENS,
        signal: controller.signal,
      },
      resolved.config,
    )
    const { text, usage } = await consumeStream(stream, controller.signal)
    if (!text.trim()) {
      return { model: modelId, providerId, text: '', error: 'empty response', usage }
    }
    return { model: modelId, providerId, text, usage }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { model: modelId, providerId, text: '', error: msg }
  } finally {
    clearTimeout(timer)
  }
}

export const moaTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: true,
  concurrencySafe: false,
  create: (ctx) =>
    tool({
      description:
        'Run multiple AI models in parallel and return a single synthesized answer ' +
        '(Mixture of Agents). Useful for hard reasoning/analysis questions where ' +
        'consensus across runs reduces hallucination. NOTE: this issues N+1 LLM calls ' +
        '(N candidates + 1 synthesizer); bounded by `maxModels` (default 3). Pass ' +
        '`models` (array of model IDs, e.g. ["anthropic/claude-sonnet-4-20250514", ' +
        '"openai/gpt-4.1"]) to use specific models; omit to reuse this Agent\'s own model ' +
        'with temperature variations.',
      inputSchema: z.object({
        prompt: z
          .string()
          .min(1)
          .max(16000)
          .describe('The question/prompt to reason about. Each candidate answers this verbatim.'),
        models: z
          .array(z.string().min(1))
          .max(8)
          .optional()
          .describe(
            'Model IDs to consult. Omit to reuse this Agent\'s model N times with varied temperature. ' +
              'Duplicate IDs are deduplicated.',
          ),
        maxModels: z
          .number()
          .int()
          .positive()
          .max(8)
          .optional()
          .describe('How many candidate runs to execute (default 3, hard max 8). Ignored/expands when `models` lists more IDs than this.'),
        strategy: z
          .enum(['parallel', 'debate', 'vote'])
          .optional()
          .describe('Aggregation strategy. Phase 1 only supports `parallel`; `debate`/`vote` fall back to `parallel`.'),
        synthesisModel: z
          .string()
          .min(1)
          .optional()
          .describe('Model ID for the synthesizer pass. Omit to reuse the first candidate\'s model.'),
      }),
      execute: async ({ prompt, models, maxModels, strategy: strategyArg, synthesisModel }) => {
        const strategy = normalizeStrategy(strategyArg)

        // For debate: after initial candidates, run a critique round where each
        // candidate sees the others' answers and revises. For vote: extract a
        // short answer from each candidate and tally. Parallel: skip both.
        const useDebate = strategy === 'debate'
        const useVote = strategy === 'vote'

        // ─── Resolve the candidate model list ────────────────────────────────
        const explicitModels = Array.from(new Set((models ?? []).map((m) => m.trim()).filter(Boolean)))
        const count = clampMaxModels(
          explicitModels.length > 0 ? explicitModels.length : maxModels,
          8,
        )

        // Build the effective candidate model descriptors.
        type ModelDesc = { modelId: string; providerId?: string }
        let candidateModels: ModelDesc[]
        if (explicitModels.length > 0) {
          // Honor explicit list, clamped to count (more IDs than maxModels → keep them all
          // since the caller was explicit; the cap is a budget for the auto-expansion case).
          candidateModels = explicitModels.slice(0, Math.max(count, explicitModels.length)).map((m) => ({ modelId: m }))
        } else {
          // Auto-expand the Agent's own model `count` times (by default 3).
          const fallback = await resolveAgentDefaultModel(ctx.agentId)
          if ('error' in fallback) {
            return formatMoarResult(
              `[moa: could not resolve a default model for agent ${ctx.agentId}: ${fallback.error}. Pass an explicit \`models\` array.]`,
              [],
              strategy,
              prompt,
            )
          }
          candidateModels = Array.from({ length: count }, () => ({
            modelId: fallback.modelId,
            providerId: fallback.providerId,
          }))
        }

        const temps = variationTemperatures(candidateModels.length)
        const candidates = await Promise.all(
          candidateModels.map((m, i) => runCandidate(m.modelId, m.providerId, prompt, temps[i] ?? 0.5)),
        )

        // ─── Synthesizer pass ─────────────────────────────────────────────────
        // Pick the synthesizer model: explicit > first successful candidate > agent default.
        let synthModel: { modelId: string; providerId?: string } | undefined =
          synthesisModel ? { modelId: synthesisModel } : undefined
        if (!synthModel) {
          const firstOk = candidates.find((c) => !c.error)
          if (firstOk) synthModel = { modelId: firstOk.model, providerId: firstOk.providerId }
        }
        if (!synthModel) {
          const def = await resolveAgentDefaultModel(ctx.agentId)
          if (!('error' in def)) synthModel = { modelId: def.modelId, providerId: def.providerId }
        }

        // ─── Debate round (optional) ──────────────────────────────────────────
        let debateCandidates = candidates
        if (useDebate && candidates.filter((c) => !c.error).length >= 2) {
          log.info({ agentId: ctx.agentId, count: candidates.length }, 'moa: debate critique round')
          debateCandidates = await Promise.all(
            candidates.map(async (c, i) => {
              if (c.error) return c
              const others = candidates.filter((_, j) => j !== i && !candidates[j]!.error)
                .map((o) => ({ model: o.model, text: o.text }))
              const critiqueMsgs = buildDebateCritiquePrompt(prompt, c.text, others)
              const critiqueResolved = await resolveModel(c.model, c.providerId)
              if ('error' in critiqueResolved) return c
              const controller = new AbortController()
              const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS)
              try {
                const stream = critiqueResolved.provider.chat(
                  critiqueResolved.model,
                  { messages: critiqueMsgs, maxOutputTokens: CANDIDATE_MAX_OUTPUT_TOKENS, signal: controller.signal },
                  critiqueResolved.config,
                )
                const { text } = await consumeStream(stream, controller.signal)
                return { ...c, text: text || c.text }
              } catch {
                return c // keep original on error
              } finally {
                clearTimeout(timer)
              }
            }),
          )
        }

        // ─── Vote extraction (optional) ──────────────────────────────────────────
        if (useVote) {
          const voteAnswers = debateCandidates
            .filter((c) => !c.error)
            .map((c) => extractVoteAnswer(c.text))
          if (voteAnswers.length > 0) {
            const { winner, votes } = tallyVotes(voteAnswers)
            return formatMoarResult(
              winner,
              debateCandidates.map((c) => ({
                ...c,
                text: c.error ? c.text : `Vote: ${extractVoteAnswer(c.text)}`,
              })),
              strategy,
              prompt,
            )
          }
        }

        const synReq = buildSynthesizerRequest(prompt, debateCandidates, strategy)
        let finalAnswer = ''
        if (!synthModel) {
          finalAnswer =
            '[moa: no synthesizer model available — every candidate failed and no default model could be resolved.]'
        } else {
          const synthResolved = await resolveModel(synthModel.modelId, synthModel.providerId)
          if ('error' in synthResolved) {
            finalAnswer = `[moa: synthesizer model "${synthModel.modelId}" could not be resolved: ${synthResolved.error}]`
          } else {
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS * 2)
            try {
              const stream = synthResolved.provider.chat(
                synthResolved.model,
                {
                  messages: synReq.messages,
                  system: synReq.system,
                  maxOutputTokens: SYNTHESIZER_MAX_OUTPUT_TOKENS,
                  signal: controller.signal,
                },
                synthResolved.config,
              )
              const { text } = await consumeStream(stream, controller.signal)
              finalAnswer = text
            } catch (err) {
              finalAnswer = `[moa: synthesizer call failed: ${err instanceof Error ? err.message : String(err)}]`
            } finally {
              clearTimeout(timer)
            }
          }
        }

        return formatMoarResult(finalAnswer, debateCandidates, strategy, prompt)
      },
    }),
}

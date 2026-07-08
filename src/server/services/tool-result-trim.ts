/**
 * Pure helpers that replace oversized tool-result payloads with a cache-safe
 * head + tail + contextual landmark placeholder.
 *
 * Background (`buildMessageHistory` in `agent-engine.ts`, the SIZE_CAP path):
 * when a tool result exceeds `config.toolResultSizeCapTokens`, the payload sent
 * to the LLM must shrink below the keep-window cap. The previous behavior
 * dropped ALL content and replaced it with a generic "trimmed, re-run the tool"
 * line — the agent lost every landmark (returned file path, opening structure,
 * trailing error lines) in a single step. On long tasks this is the dominant
 * cause of "amnesia": the model can no longer see what its tool just produced
 * and starts guessing / re-issuing the same call.
 *
 * The assistant-text and user-text caps (`assistantContentSizeCapTokens`,
 * `userContentSizeCapTokens`) already preserve head + tail. This module brings
 * the tool-result cap to the same standard in one place, so the transformation
 * is independently testable and free of DB/config surface.
 *
 * Cache-safety is the hard constraint: the LLM payload must be deterministic
 * per message so Anthropic prompt caching prefix stays stable turn-over-turn.
 * `summarizeOversizedToolResultValue` depends only on `(value, toolName,
 * capTokens, originalTokens)`; for the same message these are all stable (a
 * value at N tokens always trims to the same head/tail), so the prefix settles
 * after the first apply — same guarantee the existing inline code relied on.
 */

const HEAD_CHARS = 2000
const TAIL_CHARS = 2000

/**
 * Coerce a tool-result `output.value` to the same string representation the
 * SIZE_CAP path uses (`typeof value === 'string' ? value : JSON.stringify(value)`).
 */
export function toolResultValueToString(value: unknown): string {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

/**
 * Build a cache-safe, head + tail + landmark replacement for a tool-result
 * that exceeded the keep-window size cap.
 *
 * - `value`      the raw `output.value` (string or object) before trimming.
 * - `toolName`   the originating tool name, if known (kept for the landmark
 *                line so the agent knows which tool to re-run).
 * - `capTokens`   the SIZE_CAP that was exceeded (for the landmark line).
 * - `originalTokens` the token estimate of the full value (already computed
 *                upstream via `estimateTokens`; reused so no extra estimate is
 *                needed and the count reported is identical to the cap gate).
 *
 * Returns a string that contains:
 *   1. the leading `HEAD_CHARS` characters (usually the return header — path,
 *      command echo, first heading / opening lines of stdout),
 *   2. a contextual landmark line (tool name + counts + re-run hint),
 *   3. the trailing `TAIL_CHARS` characters (usually errors / exit summary /
 *      final lines), so the agent keeps the most-referenced anchors.
 *
 * For values shorter than `HEAD_CHARS + TAIL_CHARS` (which shouldn't happen
 * past the cap gate, but is defensive) the full value is returned untouched.
 */
export function summarizeOversizedToolResultValue(
  value: unknown,
  toolName: string | undefined,
  capTokens: number,
  originalTokens: number,
): string {
  const text = toolResultValueToString(value)
  // Defensive: if the serialized form is short enough, keep it verbatim rather
  // than risk splitting in the middle of a tiny payload. (The cap gate has
  // already classified this as oversized, so this is a near-dead branch.)
  if (text.length <= HEAD_CHARS + TAIL_CHARS) return text

  const head = text.slice(0, HEAD_CHARS).trimEnd()
  const tail = text.slice(-TAIL_CHARS).trimStart()
  const name = toolName || 'unknown'
  return (
    `${head}\n\n` +
    `[…tool result trimmed: ${name} returned ~${originalTokens.toLocaleString()} tokens, exceeding the ${capTokens.toLocaleString()}-token keep-window cap. Head + tail preserved; re-run ${name} if you need the full output.]\n\n` +
    `${tail}`
  )
}

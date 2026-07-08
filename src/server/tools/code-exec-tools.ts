/**
 * `run_code` — sandboxed code execution.
 *
 * Runs a code snippet in an ephemeral working directory with a minimal
 * environment (no agent workspace, no vault secrets unless explicitly passed).
 * Supported languages: `javascript` (Bun), `python` (python3), `shell` (bash).
 *
 * Why this exists (I-20 / EPIC-2): `gezyhd` has a `code_execution` toolset that
 * lets the agent "think via code" — verify logic, crunch data, prototype a fix
 * before applying it. `gezyhive` only had `run_shell` (bash), which is fine for
 * shell commands but awkward for multi-line Python/JS logic. This tool gives
 * the agent a proper sandboxed code runner with structured output.
 *
 * Security surface:
 *   - `defaultDisabled: true` — opt-in via toolbox (like browser-session tools).
 *   - `readOnly: false` — executes code, has side effects.
 *   - `concurrencySafe: false` — resource contention if multiple runs overlap.
 *   - Ephemeral temp dir per call (cleaned up after).
 *   - Minimal env (PATH, HOME, LANG, TERM) — no agent secrets leaked.
 *   - Timeout-bounded (default 30s, max 120s via env GEZY_CODE_EXEC_MAX_TIMEOUT).
 *   - Output capped at MAX_OUTPUT_CHARS (head + tail) to avoid context flooding.
 *
 * Pure helpers (`buildExecutionCommand`, `truncateCodeOutput`,
 * `formatCodeExecutionResult`, `resolveInterpreter`) are exported without heavy
 * deps so they can be unit-tested directly.
 */
import { z } from 'zod'
import { tool } from '@/server/tools/tool-helper'
import { createLogger } from '@/server/logger'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('code-exec-tool')

const DEFAULT_TIMEOUT_MS =
  Number(process.env.GEZY_CODE_EXEC_TIMEOUT_MS ?? 0) > 0
    ? Number(process.env.GEZY_CODE_EXEC_TIMEOUT_MS)
    : 30_000
const MAX_TIMEOUT_MS =
  Number(process.env.GEZY_CODE_EXEC_MAX_TIMEOUT_MS ?? 0) > 0
    ? Number(process.env.GEZY_CODE_EXEC_MAX_TIMEOUT_MS)
    : 120_000
const MAX_OUTPUT_CHARS =
  Number(process.env.GEZY_CODE_EXEC_MAX_OUTPUT_CHARS ?? 0) > 0
    ? Number(process.env.GEZY_CODE_EXEC_MAX_OUTPUT_CHARS)
    : 30_000

export type CodeLanguage = 'javascript' | 'python' | 'shell'

/**
 * Resolve the interpreter command for a language. Returns `null` if the
 * language is not recognised. Pure — no I/O.
 */
export function resolveInterpreter(language: string): string[] | null {
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
    case 'typescript':
    case 'ts':
      return ['bun']
    case 'python':
    case 'py':
      return ['python3']
    case 'shell':
    case 'bash':
    case 'sh':
      return ['bash']
    default:
      return null
  }
}

/**
 * Build the execution command for a language + code file path.
 * Returns `[...interpreterArgs, filePath]` or `null` for unknown languages.
 * Pure — no I/O.
 */
export function buildExecutionCommand(
  language: string,
  codeFilePath: string,
): string[] | null {
  const interp = resolveInterpreter(language)
  if (!interp) return null
  // For shell, use `bash <file>` (same as run_shell but via file for multi-line).
  // For python, `python3 <file>`.
  // For javascript, `bun <file>` (Bun runs .js/.ts natively).
  return [...interp, codeFilePath]
}

/**
 * Determine the file extension for a language. Pure.
 */
export function codeFileExtension(language: string): string {
  const lang = language.toLowerCase()
  if (lang === 'python' || lang === 'py') return '.py'
  if (lang === 'shell' || lang === 'bash' || lang === 'sh') return '.sh'
  // javascript / typescript → .ts (Bun handles both)
  return '.ts'
}

/** Truncate output to MAX_OUTPUT_CHARS, keeping head + tail. Pure. */
export function truncateCodeOutput(
  text: string,
  maxChars: number = MAX_OUTPUT_CHARS,
): { value: string; truncated: boolean; omitted: number } {
  if (text.length <= maxChars) return { value: text, truncated: false, omitted: 0 }
  const head = text.slice(0, Math.floor(maxChars * 0.6))
  const tail = text.slice(-Math.floor(maxChars * 0.3))
  const omitted = text.length - head.length - tail.length
  return {
    value: `${head}\n\n[…truncated ${omitted.toLocaleString()} chars. Re-run with narrower output if needed.]\n\n${tail}`,
    truncated: true,
    omitted,
  }
}

/** Format the structured result object returned to the LLM. Pure. */
export function formatCodeExecutionResult(
  language: string,
  stdout: string,
  stderr: string,
  exitCode: number | null,
  durationMs: number,
  truncated: boolean,
  omittedChars: number,
  timedOut: boolean,
): {
  success: boolean
  language: string
  stdout: string
  stderr: string
  exitCode: number | null
  durationMs: number
  truncated: boolean
  omittedChars: number
  timedOut: boolean
} {
  return {
    success: !timedOut && exitCode === 0,
    language,
    stdout,
    stderr,
    exitCode,
    durationMs,
    truncated,
    omittedChars,
    timedOut,
  }
}

/** Minimal environment for sandboxed execution — no agent secrets. */
function minimalEnv(): Record<string, string> {
  return {
    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    HOME: process.env.HOME ?? '/tmp',
    LANG: process.env.LANG ?? 'en_US.UTF-8',
    TERM: process.env.TERM ?? 'xterm-256color',
  }
}

export const codeExecutionTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: false,
  concurrencySafe: false,
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'Run a code snippet in a sandboxed ephemeral directory with a minimal environment (no agent workspace, no vault secrets). ' +
        'Use this when you need to **execute logic** — verify a calculation, test a regex, prototype a function, process data — ' +
        'rather than embedding the logic in a shell one-liner. Supported languages: `javascript` (Bun), `python` (python3), `shell` (bash). ' +
        'Returns structured `{ stdout, stderr, exitCode, durationMs, truncated, timedOut }`. ' +
        'Output is capped at ~30KB (head + tail preserved). Timeout default 30s, max 120s. ' +
        '**Security**: runs in an ephemeral temp dir with a minimal env (PATH/HOME/LANG/TERM only) — ' +
        'does NOT inherit agent workspace or vault secrets. Pass secrets explicitly via env if needed.',
      inputSchema: z.object({
        language: z
          .enum(['javascript', 'python', 'shell'])
          .describe('Programming language to execute.'),
        code: z
          .string()
          .min(1)
          .max(100_000)
          .describe('The code to execute. Written to a temp file and run with the language interpreter.'),
        stdin: z
          .string()
          .max(100_000)
          .optional()
          .describe('Standard input to pipe to the process.'),
        timeout: z
          .number()
          .int()
          .min(1)
          .max(Math.floor(MAX_TIMEOUT_MS / 1000))
          .optional()
          .describe(`Timeout in seconds. Default 30, max ${Math.floor(MAX_TIMEOUT_MS / 1000)}.`),
      }),
      execute: async ({ language, code, stdin, timeout }) => {
        const ext = codeFileExtension(language)
        const timeoutMs = Math.min(
          (timeout ?? DEFAULT_TIMEOUT_MS / 1000) * 1000,
          MAX_TIMEOUT_MS,
        )

        // Create ephemeral temp directory
        const tempDir = mkdtempSync(join(tmpdir(), 'gezy-code-'))
        const codeFile = join(tempDir, `main${ext}`)

        try {
          writeFileSync(codeFile, code, 'utf-8')

          const cmd = buildExecutionCommand(language, codeFile)
          if (!cmd) {
            return formatCodeExecutionResult(
              language, '', `Unsupported language: ${language}`, null, 0, false, 0, false,
            )
          }

          const startTime = Date.now()
          let proc: ReturnType<typeof Bun.spawn> | undefined
          let timeoutHandle: ReturnType<typeof setTimeout> | undefined
          let timedOut = false

          try {
            proc = Bun.spawn(cmd, {
              cwd: tempDir,
              stdout: 'pipe',
              stderr: 'pipe',
              stdin: stdin ? 'pipe' : 'ignore',
              env: minimalEnv(),
            })

            // Write stdin if provided
            if (stdin && proc.stdin && typeof proc.stdin === 'object') {
              ;(proc.stdin as import('bun').FileSink).write(stdin)
              ;(proc.stdin as import('bun').FileSink).end()
            }

            const timeoutPromise = new Promise<never>((_, reject) => {
              timeoutHandle = setTimeout(() => {
                timedOut = true
                proc?.kill()
                reject(new Error('Execution timeout'))
              }, timeoutMs)
            })

            const exitCode = await Promise.race([proc.exited, timeoutPromise])
            const stdoutRaw = await new Response(proc.stdout as ReadableStream<Uint8Array>).text()
            const stderrRaw = await new Response(proc.stderr as ReadableStream<Uint8Array>).text()
            const durationMs = Date.now() - startTime

            const stdout = truncateCodeOutput(stdoutRaw)
            const stderr = truncateCodeOutput(stderrRaw)

            return formatCodeExecutionResult(
              language,
              stdout.value,
              stderr.value,
              exitCode,
              durationMs,
              stdout.truncated || stderr.truncated,
              stdout.omitted + stderr.omitted,
              false,
            )
          } catch (err) {
            const durationMs = Date.now() - startTime
            if (timedOut) {
              return formatCodeExecutionResult(
                language, '', `Execution timeout after ${timeoutMs / 1000}s`, null, durationMs, false, 0, true,
              )
            }
            const msg = err instanceof Error ? err.message : String(err)
            return formatCodeExecutionResult(
              language, '', `Failed to execute: ${msg}`, null, durationMs, false, 0, false,
            )
          } finally {
            if (timeoutHandle) clearTimeout(timeoutHandle)
          }
        } finally {
          // Clean up ephemeral dir
          try {
            rmSync(tempDir, { recursive: true, force: true })
          } catch {
            // best-effort
          }
        }
      },
    }),
}

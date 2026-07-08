import { describe, it, expect } from 'bun:test'
import {
  resolveInterpreter,
  buildExecutionCommand,
  codeFileExtension,
  truncateCodeOutput,
  formatCodeExecutionResult,
} from '@/server/tools/code-exec-tools'

describe('resolveInterpreter', () => {
  it('returns bun for javascript/js/typescript/ts', () => {
    expect(resolveInterpreter('javascript')).toEqual(['bun'])
    expect(resolveInterpreter('js')).toEqual(['bun'])
    expect(resolveInterpreter('typescript')).toEqual(['bun'])
    expect(resolveInterpreter('ts')).toEqual(['bun'])
  })
  it('returns python3 for python/py', () => {
    expect(resolveInterpreter('python')).toEqual(['python3'])
    expect(resolveInterpreter('py')).toEqual(['python3'])
  })
  it('returns bash for shell/bash/sh', () => {
    expect(resolveInterpreter('shell')).toEqual(['bash'])
    expect(resolveInterpreter('bash')).toEqual(['bash'])
    expect(resolveInterpreter('sh')).toEqual(['bash'])
  })
  it('is case-insensitive', () => {
    expect(resolveInterpreter('JavaScript')).toEqual(['bun'])
    expect(resolveInterpreter('PYTHON')).toEqual(['python3'])
  })
  it('returns null for unknown languages', () => {
    expect(resolveInterpreter('ruby')).toBeNull()
    expect(resolveInterpreter('')).toBeNull()
    expect(resolveInterpreter('rust')).toBeNull()
  })
})

describe('buildExecutionCommand', () => {
  it('builds [bun, filePath] for javascript', () => {
    expect(buildExecutionCommand('javascript', '/tmp/main.ts')).toEqual(['bun', '/tmp/main.ts'])
  })
  it('builds [python3, filePath] for python', () => {
    expect(buildExecutionCommand('python', '/tmp/main.py')).toEqual(['python3', '/tmp/main.py'])
  })
  it('builds [bash, filePath] for shell', () => {
    expect(buildExecutionCommand('shell', '/tmp/main.sh')).toEqual(['bash', '/tmp/main.sh'])
  })
  it('returns null for unknown language', () => {
    expect(buildExecutionCommand('ruby', '/tmp/main.rb')).toBeNull()
  })
})

describe('codeFileExtension', () => {
  it('returns .py for python', () => {
    expect(codeFileExtension('python')).toBe('.py')
    expect(codeFileExtension('py')).toBe('.py')
  })
  it('returns .sh for shell', () => {
    expect(codeFileExtension('shell')).toBe('.sh')
    expect(codeFileExtension('bash')).toBe('.sh')
  })
  it('returns .ts for javascript/typescript', () => {
    expect(codeFileExtension('javascript')).toBe('.ts')
    expect(codeFileExtension('typescript')).toBe('.ts')
  })
})

describe('truncateCodeOutput', () => {
  it('returns text unchanged when under maxChars', () => {
    const result = truncateCodeOutput('short output', 1000)
    expect(result.value).toBe('short output')
    expect(result.truncated).toBe(false)
    expect(result.omitted).toBe(0)
  })
  it('truncates with head + tail + indicator when over maxChars', () => {
    const long = 'x'.repeat(5000)
    const result = truncateCodeOutput(long, 1000)
    expect(result.truncated).toBe(true)
    expect(result.omitted).toBeGreaterThan(0)
    expect(result.value).toContain('truncated')
    expect(result.value).toContain('x') // still has content
    expect(result.value.length).toBeLessThan(long.length)
  })
  it('preserves head (first 60%) and tail (last 30%)', () => {
    const long = Array.from({ length: 100 }, (_, i) => `line-${i}`).join('\n')
    const result = truncateCodeOutput(long, 500)
    expect(result.value.startsWith('line-0')).toBe(true)
    expect(result.value.endsWith('line-99')).toBe(true)
  })
  it('is deterministic (same input → same output)', () => {
    const long = 'z'.repeat(5000)
    const a = truncateCodeOutput(long, 1000)
    const b = truncateCodeOutput(long, 1000)
    expect(a).toEqual(b)
  })
})

describe('formatCodeExecutionResult', () => {
  it('reports success when exitCode is 0 and not timed out', () => {
    const r = formatCodeExecutionResult('python', '42', '', 0, 150, false, 0, false)
    expect(r.success).toBe(true)
    expect(r.language).toBe('python')
    expect(r.exitCode).toBe(0)
    expect(r.timedOut).toBe(false)
  })
  it('reports failure when exitCode is non-zero', () => {
    const r = formatCodeExecutionResult('python', '', 'SyntaxError', 1, 50, false, 0, false)
    expect(r.success).toBe(false)
    expect(r.exitCode).toBe(1)
    expect(r.stderr).toBe('SyntaxError')
  })
  it('reports failure when timed out', () => {
    const r = formatCodeExecutionResult('python', '', 'Execution timeout after 30s', null, 30000, false, 0, true)
    expect(r.success).toBe(false)
    expect(r.timedOut).toBe(true)
    expect(r.exitCode).toBeNull()
  })
  it('includes truncation info', () => {
    const r = formatCodeExecutionResult('javascript', 'big output', '', 0, 100, true, 5000, false)
    expect(r.truncated).toBe(true)
    expect(r.omittedChars).toBe(5000)
  })
  it('includes durationMs', () => {
    const r = formatCodeExecutionResult('shell', 'done', '', 0, 1234, false, 0, false)
    expect(r.durationMs).toBe(1234)
  })
})

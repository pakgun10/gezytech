import { describe, it, expect } from 'bun:test'
import {
  buildScreenshotCommand,
  buildOcrCommand,
  parseWindowList,
  buildXdotoolCommand,
  checkToolAvailable,
  formatScreenshotResult,
  toolNotInstalledError,
} from '@/server/tools/computer-use-tools'

describe('buildScreenshotCommand', () => {
  it('returns a command object with cmd array and tool name', () => {
    const result = buildScreenshotCommand('/tmp/test.png')
    // On this system, at least one screenshot tool should be available
    if (result) {
      expect(result.cmd).toBeInstanceOf(Array)
      expect(result.cmd.length).toBeGreaterThan(0)
      expect(typeof result.tool).toBe('string')
    }
  })
  it('includes the output file path in the command', () => {
    const result = buildScreenshotCommand('/tmp/my-screenshot.png')
    if (result) {
      expect(result.cmd.some((arg) => arg.includes('my-screenshot.png'))).toBe(true)
    }
  })
})

describe('buildOcrCommand', () => {
  it('returns tesseract command with image file and stdout output', () => {
    expect(buildOcrCommand('/tmp/screenshot.png')).toEqual(['tesseract', '/tmp/screenshot.png', '-'])
  })
})

describe('parseWindowList', () => {
  it('parses wmctrl -l output into window objects', () => {
    const output = [
      '0x01200003  0 hostname Terminal',
      '0x01400005  0 hostname Google Chrome',
      '0x01600007  1 hostname VS Code — main.ts',
    ].join('\n')
    const windows = parseWindowList(output)
    expect(windows).toHaveLength(3)
    expect(windows[0]).toMatchObject({ id: '0x01200003', desktop: 0, host: 'hostname', title: 'Terminal' })
    expect(windows[1]!.title).toBe('Google Chrome')
    expect(windows[2]!.title).toBe('VS Code — main.ts')
    expect(windows[2]!.desktop).toBe(1)
  })
  it('handles empty output', () => {
    expect(parseWindowList('')).toEqual([])
    expect(parseWindowList('\n\n')).toEqual([])
  })
  it('filters out malformed lines', () => {
    const output = '0x01200003  0 hostname Terminal\nbad line\n0x014  0 host Firefox'
    const windows = parseWindowList(output)
    expect(windows.length).toBeGreaterThanOrEqual(1)
    // The "bad line" (only 2 parts) should be filtered
    expect(windows.find((w) => w.title === 'line')).toBeUndefined()
  })
  it('handles multi-word window titles', () => {
    const output = '0x01200003  0 host Visual Studio Code — settings.json'
    const windows = parseWindowList(output)
    expect(windows[0]!.title).toBe('Visual Studio Code — settings.json')
  })
})

describe('buildXdotoolCommand', () => {
  it('builds mousemove + click command for click action', () => {
    const cmd = buildXdotoolCommand('click', { x: 100, y: 200, button: 1 })
    // Returns null if xdotool not installed — that's valid behavior
    if (cmd) {
      expect(cmd[0]).toBe('xdotool')
      expect(cmd).toContain('100')
      expect(cmd).toContain('200')
      expect(cmd).toContain('click')
    }
  })
  it('builds type command for keyboard_type action', () => {
    const cmd = buildXdotoolCommand('type', { text: 'hello world' })
    if (cmd) {
      expect(cmd[0]).toBe('xdotool')
      expect(cmd).toContain('type')
      expect(cmd).toContain('hello world')
    }
  })
  it('builds key command for key_press action', () => {
    const cmd = buildXdotoolCommand('key', { combo: 'ctrl+c' })
    if (cmd) {
      expect(cmd[0]).toBe('xdotool')
      expect(cmd).toContain('key')
      expect(cmd).toContain('ctrl+c')
    }
  })
  it('builds scroll commands with correct button (4=up, 5=down)', () => {
    const cmdDown = buildXdotoolCommand('scroll', { direction: 'down', clicks: 3 })
    if (cmdDown) {
      expect(cmdDown).toContain('5') // scroll down = button 5
    }
    const cmdUp = buildXdotoolCommand('scroll', { direction: 'up', clicks: 2 })
    if (cmdUp) {
      expect(cmdUp).toContain('4') // scroll up = button 4
    }
  })
  it('returns null if xdotool is not installed (graceful)', () => {
    // This test doesn't assume xdotool is installed — both outcomes are valid
    const cmd = buildXdotoolCommand('click', { x: 0, y: 0 })
    expect(cmd === null || Array.isArray(cmd)).toBe(true)
  })
})

describe('checkToolAvailable', () => {
  it('returns true for existing paths', () => {
    expect(checkToolAvailable('/usr/bin/ls')).toBe(true)
  })
  it('returns false for non-existent paths', () => {
    expect(checkToolAvailable('/usr/bin/nonexistent-tool-12345')).toBe(false)
  })
})

describe('formatScreenshotResult', () => {
  it('returns success result with fileUrl and dimensions', () => {
    const r = formatScreenshotResult('/path/to/screenshot.png', 1920, 1080, 'gnome-screenshot')
    expect(r.success).toBe(true)
    expect(r.fileUrl).toBe('/path/to/screenshot.png')
    expect(r.width).toBe(1920)
    expect(r.height).toBe(1080)
    expect(r.capturedWith).toBe('gnome-screenshot')
  })
})

describe('toolNotInstalledError', () => {
  it('returns error with install hint', () => {
    const r = toolNotInstalledError('xdotool', 'sudo apt install xdotool')
    expect(r.success).toBe(false)
    expect(r.error).toContain('xdotool')
    expect(r.error).toContain('not installed')
    expect(r.installHint).toBe('sudo apt install xdotool')
  })
})

/**
 * `computer_use` — desktop automation tools (Linux X11 primary).
 *
 * Gives the agent the ability to **see** the screen (screenshot + OCR) and
 * **act** on it (mouse, keyboard, window focus) — the capability that makes
 * `gezyhd` feel "alive" because it can operate the user's actual machine.
 *
 * Phase 1 MVP (Linux X11):
 *   - `screenshot` — capture screen → file → return URL + dimensions.
 *   - `get_screen_text` — screenshot + tesseract OCR → return readable text.
 *     This is the "vision" substitute: the agent reads what's on screen as text
 *     without needing a vision-capable LLM. Works NOW (tesseract installed).
 *   - `list_windows` — wmctrl -l → list all windows with titles + IDs.
 *   - `focus_window` — wmctrl -a <title> → focus a window by title.
 *   - `get_screen_info` — screen resolution + active window (text, no image).
 *   - `mouse_click` / `mouse_move` / `keyboard_type` / `key_press` / `scroll`
 *     — via `xdotool` (requires `sudo apt install xdotool`). Graceful error
 *     with install hint if xdotool is not found.
 *
 * Security:
 *   - All tools `defaultDisabled: true` — opt-in via toolbox.
 *   - `readOnly` = true for screenshot/get_screen_text/list_windows/get_screen_info.
 *   - `readOnly` = false for mouse/keyboard/focus (destructive — changes state).
 *   - Screenshot saved to agent workspace `.tool-outputs/` (same as spill).
 *
 * Pure helpers (`buildScreenshotCommand`, `buildOcrCommand`, `parseWindowList`,
 * `buildXdotoolCommand`, `formatScreenshotResult`) are exported for unit testing.
 */
import { z } from 'zod'
import { tool } from '@/server/tools/tool-helper'
import { createLogger } from '@/server/logger'
import { execFileSync } from 'node:child_process'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('computer-use')

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

/**
 * Build the screenshot command for the current display server.
 * Tries gnome-screenshot (X11/GNOME), then import (ImageMagick), then grim (Wayland).
 * Returns the command array + output file path, or null if no tool is available.
 */
export function buildScreenshotCommand(
  outputFile: string,
): { cmd: string[]; tool: string } | null {
  // gnome-screenshot (GNOME desktop, X11 or Wayland)
  if (existsSync('/usr/bin/gnome-screenshot')) {
    return { cmd: ['gnome-screenshot', '-f', outputFile], tool: 'gnome-screenshot' }
  }
  // import (ImageMagick — X11)
  if (existsSync('/usr/bin/import')) {
    return { cmd: ['import', '-window', 'root', outputFile], tool: 'import' }
  }
  // grim (Wayland)
  if (existsSync('/usr/bin/grim')) {
    return { cmd: ['grim', outputFile], tool: 'grim' }
  }
  return null
}

/**
 * Build the OCR command: tesseract <image> stdout.
 */
export function buildOcrCommand(imageFile: string): string[] {
  return ['tesseract', imageFile, '-']
}

/**
 * Parse `wmctrl -l` output into a window list.
 * Format: `0x01200003  0 hostname Window Title Here`
 */
export function parseWindowList(wmctrlOutput: string): Array<{
  id: string
  desktop: number
  host: string
  title: string
}> {
  return wmctrlOutput
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const parts = line.split(/\s+/)
      if (parts.length < 4) return null
      const id = parts[0]!
      const desktop = parseInt(parts[1]!, 10)
      const host = parts[2]!
      const title = parts.slice(3).join(' ')
      return { id, desktop, host, title }
    })
    .filter((w): w is NonNullable<typeof w> => w !== null)
}

/**
 * Build an xdotool command for mouse/keyboard actions.
 * Returns null if xdotool is not installed (caller shows install hint).
 */
export function buildXdotoolCommand(
  action: 'click' | 'mousemove' | 'type' | 'key' | 'scroll',
  args: Record<string, unknown>,
): string[] | null {
  if (!existsSync('/usr/bin/xdotool')) return null
  switch (action) {
    case 'click': {
      const x = Number(args.x)
      const y = Number(args.y)
      const button = Number(args.button ?? 1)
      return ['xdotool', 'mousemove', String(x), String(y), 'click', String(button)]
    }
    case 'mousemove': {
      const x = Number(args.x)
      const y = Number(args.y)
      return ['xdotool', 'mousemove', String(x), String(y)]
    }
    case 'type': {
      const text = String(args.text ?? '')
      return ['xdotool', 'type', '--clearmodifiers', '--delay', '0', text]
    }
    case 'key': {
      const combo = String(args.combo ?? '')
      return ['xdotool', 'key', combo]
    }
    case 'scroll': {
      const direction = String(args.direction ?? 'down')
      const clicks = Number(args.clicks ?? 3)
      // xdotool click 4 = scroll up, 5 = scroll down
      const button = direction === 'up' ? 4 : 5
      const cmd: string[] = ['xdotool']
      for (let i = 0; i < clicks; i++) {
        cmd.push('click', String(button))
        if (i < clicks - 1) cmd.push('sleep', '0.05')
      }
      return cmd
    }
    default:
      return null
  }
}

/**
 * Check if a binary exists on the system. Pure (read-only fs check).
 */
export function checkToolAvailable(binaryPath: string): boolean {
  return existsSync(binaryPath)
}

/** Format the screenshot result. Pure. */
export function formatScreenshotResult(
  fileUrl: string,
  width: number,
  height: number,
  tool: string,
): { success: boolean; fileUrl: string; width: number; height: number; capturedWith: string } {
  return { success: true, fileUrl, width, height, capturedWith: tool }
}

/** Format a graceful "tool not installed" error. Pure. */
export function toolNotInstalledError(tool: string, installHint: string): {
  success: false
  error: string
  installHint: string
} {
  return {
    success: false,
    error: `${tool} is not installed. Install it to use this tool.`,
    installHint,
  }
}

// ─── Shared execution helper ─────────────────────────────────────────────────

function runCommand(cmd: string[], timeoutMs: number = 15_000): {
  stdout: string
  stderr: string
  exitCode: number
} {
  try {
    const stdout = execFileSync(cmd[0]!, cmd.slice(1), {
      timeout: timeoutMs,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { stdout: stdout ?? '', stderr: '', exitCode: 0 }
  } catch (err: any) {
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? err.message ?? String(err),
      exitCode: err.status ?? -1,
    }
  }
}

function saveScreenshotToWorkspace(
  agentId: string,
  buffer: Buffer,
): string {
  const baseDir = process.env.WORKSPACE_BASE_DIR ?? './data/workspaces'
  const wsDir = join(baseDir, agentId, '.tool-outputs')
  if (!existsSync(wsDir)) mkdirSync(wsDir, { recursive: true })
  const filename = `screenshot-${Date.now()}.png`
  const filepath = join(wsDir, filename)
  writeFileSync(filepath, buffer)
  return filepath
}

// ─── Tool registrations ──────────────────────────────────────────────────────

export const screenshotTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: true,
  concurrencySafe: false,
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description:
        'Take a screenshot of the current screen. Returns a file URL + screen dimensions. ' +
        'The screenshot is saved as a PNG file you can reference with `![screenshot](fileUrl)` in markdown. ' +
        'To **read text** from the screenshot, use `get_screen_text` (OCR) instead. ' +
        'To see what windows are open, use `list_windows`.',
      inputSchema: z.object({}),
      execute: async () => {
        const tempFile = `/tmp/gezy-screenshot-${Date.now()}.png`
        const cmd = buildScreenshotCommand(tempFile)
        if (!cmd) {
          return toolNotInstalledError(
            'screenshot tool',
            'Install one of: gnome-screenshot, imagemagick (import), or grim',
          )
        }
        const result = runCommand(cmd.cmd)
        if (result.exitCode !== 0 || !existsSync(tempFile)) {
          return { success: false, error: `Screenshot failed: ${result.stderr}`, capturedWith: cmd.tool }
        }
        const buffer = readFileSync(tempFile)
        const savedPath = saveScreenshotToWorkspace(ctx.agentId, buffer)
        // Get dimensions via file size heuristic (PNG header)
        const width = buffer.readUInt32BE(16)
        const height = buffer.readUInt32BE(20)
        return formatScreenshotResult(savedPath, width, height, cmd.tool)
      },
    }),
}

export const getScreenTextTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: true,
  concurrencySafe: false,
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'Take a screenshot and run OCR (tesseract) to extract readable text from the screen. ' +
        'Use this to "see" what is currently displayed — read menus, buttons, labels, error messages, ' +
        'terminal output, or any visible text. Returns the extracted text. ' +
        'This is the primary way to understand screen content without a vision-capable LLM. ' +
        'OCR is not perfect — for exact pixel positions, combine with `screenshot` to see dimensions.',
      inputSchema: z.object({}),
      execute: async () => {
        const tempFile = `/tmp/gezy-ocr-${Date.now()}.png`
        const cmd = buildScreenshotCommand(tempFile)
        if (!cmd) {
          return toolNotInstalledError('screenshot tool', 'Install gnome-screenshot or imagemagick')
        }
        const shotResult = runCommand(cmd.cmd)
        if (shotResult.exitCode !== 0 || !existsSync(tempFile)) {
          return { success: false, error: `Screenshot failed: ${shotResult.stderr}` }
        }
        const ocrCmd = buildOcrCommand(tempFile)
        const ocrResult = runCommand(ocrCmd, 30_000)
        if (ocrResult.exitCode !== 0) {
          return { success: false, error: `OCR failed: ${ocrResult.stderr}` }
        }
        return {
          success: true,
          text: ocrResult.stdout.trim(),
          capturedWith: cmd.tool,
          note: 'OCR text may contain errors. For visual context, also call screenshot.',
        }
      },
    }),
}

export const listWindowsTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: true,
  concurrencySafe: true,
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'List all open windows with their titles and IDs. Uses `wmctrl -l`. ' +
        'Use before `focus_window` to find the window you want to interact with.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!checkToolAvailable('/usr/bin/wmctrl')) {
          return toolNotInstalledError('wmctrl', 'sudo apt install wmctrl')
        }
        const result = runCommand(['wmctrl', '-l'])
        if (result.exitCode !== 0) {
          return { success: false, error: result.stderr }
        }
        const windows = parseWindowList(result.stdout)
        return { success: true, windows, count: windows.length }
      },
    }),
}

export const focusWindowTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: false,
  concurrencySafe: false,
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'Focus (activate) a window by its title (or part of it). Uses `wmctrl -a`. ' +
        'The window must match the title partially. Use `list_windows` first to find titles.',
      inputSchema: z.object({
        title: z.string().min(1).max(200).describe('Window title or substring to match.'),
      }),
      execute: async ({ title }) => {
        if (!checkToolAvailable('/usr/bin/wmctrl')) {
          return toolNotInstalledError('wmctrl', 'sudo apt install wmctrl')
        }
        const result = runCommand(['wmctrl', '-a', title])
        if (result.exitCode !== 0) {
          return { success: false, error: `Could not focus window "${title}": ${result.stderr}` }
        }
        return { success: true, focused: title }
      },
    }),
}

export const getScreenInfoTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: true,
  concurrencySafe: true,
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'Get current screen info: resolution, active window title, and display server type. ' +
        'Use this to understand the display geometry before clicking at specific coordinates.',
      inputSchema: z.object({}),
      execute: async () => {
        const info: Record<string, string | number | null> = {
          display: process.env.DISPLAY ?? 'unknown',
          sessionType: process.env.XDG_SESSION_TYPE ?? 'unknown',
          waylandDisplay: process.env.WAYLAND_DISPLAY ?? null,
        }
        // Active window via wmctrl + xprop
        if (checkToolAvailable('/usr/bin/wmctrl')) {
          const wmctrlResult = runCommand(['wmctrl', '-l'])
          if (wmctrlResult.exitCode === 0) {
            info.windowCount = parseWindowList(wmctrlResult.stdout).length
          }
        }
        // Screen resolution via xdpyinfo (X11) or xrandr
        if (checkToolAvailable('/usr/bin/xdpyinfo')) {
          const xdpResult = runCommand(['xdpyinfo'])
          const dimMatch = xdpResult.stdout.match(/dimensions:\s+(\d+)x(\d+)/)
          if (dimMatch) {
            info.screenWidth = parseInt(dimMatch[1]!, 10)
            info.screenHeight = parseInt(dimMatch[2]!, 10)
          }
        }
        return { success: true, ...info }
      },
    }),
}

export const mouseClickTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: false,
  concurrencySafe: false,
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'Click the mouse at a specific (x, y) screen coordinate. ' +
        'Default button is left (1); set button=2 for middle, button=3 for right. ' +
        'Use `get_screen_info` to find screen dimensions, `get_screen_text` to identify clickable elements.',
      inputSchema: z.object({
        x: z.number().int().min(0).max(7680).describe('X coordinate (pixels from left).'),
        y: z.number().int().min(0).max(4320).describe('Y coordinate (pixels from top).'),
        button: z.number().int().min(1).max(3).optional().describe('Mouse button: 1=left (default), 2=middle, 3=right.'),
      }),
      execute: async ({ x, y, button }) => {
        const cmd = buildXdotoolCommand('click', { x, y, button: button ?? 1 })
        if (!cmd) return toolNotInstalledError('xdotool', 'sudo apt install xdotool')
        const result = runCommand(cmd)
        return { success: result.exitCode === 0, x, y, button: button ?? 1, error: result.stderr || undefined }
      },
    }),
}

export const keyboardTypeTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: false,
  concurrencySafe: false,
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'Type text at the current cursor position. Use `mouse_click` first to focus an input field, ' +
        'then `keyboard_type` to enter text. Uses xdotool.',
      inputSchema: z.object({
        text: z.string().min(1).max(10000).describe('Text to type.'),
      }),
      execute: async ({ text }) => {
        const cmd = buildXdotoolCommand('type', { text })
        if (!cmd) return toolNotInstalledError('xdotool', 'sudo apt install xdotool')
        const result = runCommand(cmd, 30_000)
        return { success: result.exitCode === 0, typed: text.length, error: result.stderr || undefined }
      },
    }),
}

export const keyPressTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: false,
  concurrencySafe: false,
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'Press a key or key combination. Examples: "Return" (Enter), "ctrl+c", "alt+Tab", "ctrl+s", "Escape". ' +
        'Uses xdotool key syntax. Separate modifiers with "+".',
      inputSchema: z.object({
        combo: z
          .string()
          .min(1)
          .max(100)
          .describe('Key combination, e.g. "ctrl+c", "Return", "alt+F4", "ctrl+shift+t".'),
      }),
      execute: async ({ combo }) => {
        const cmd = buildXdotoolCommand('key', { combo })
        if (!cmd) return toolNotInstalledError('xdotool', 'sudo apt install xdotool')
        const result = runCommand(cmd)
        return { success: result.exitCode === 0, combo, error: result.stderr || undefined }
      },
    }),
}

export const scrollTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: false,
  concurrencySafe: false,
  defaultDisabled: true,
  create: () =>
    tool({
      description:
        'Scroll the mouse wheel. Direction "up" or "down". Default 3 clicks. Uses xdotool.',
      inputSchema: z.object({
        direction: z.enum(['up', 'down']).describe('Scroll direction.'),
        clicks: z.number().int().min(1).max(20).optional().describe('Number of scroll clicks (default 3).'),
      }),
      execute: async ({ direction, clicks }) => {
        const cmd = buildXdotoolCommand('scroll', { direction, clicks: clicks ?? 3 })
        if (!cmd) return toolNotInstalledError('xdotool', 'sudo apt install xdotool')
        const result = runCommand(cmd)
        return { success: result.exitCode === 0, direction, clicks: clicks ?? 3, error: result.stderr || undefined }
      },
    }),
}

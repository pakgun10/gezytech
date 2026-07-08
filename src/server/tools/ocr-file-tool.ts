/**
 * `ocr_file` — OCR text extraction from image files.
 *
 * Uses tesseract to extract readable text from image files (PNG, JPEG, etc.)
 * in the agent's workspace. This gives non-vision models (like DeepSeek)
 * the ability to "read" images — screenshots, documents, charts with text.
 *
 * Why this exists: when a user sends an image via Telegram/chat, the bot
 * downloads it to the workspace but can't "see" it without a vision model.
 * This tool bridges that gap by extracting text via OCR.
 *
 * Security: readOnly, only reads files within the agent's workspace.
 */

import { tool } from '@/server/tools/tool-helper'
import { z } from 'zod'
import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'
import type { ToolRegistration } from '@/server/tools/types'
import { resolveToolWorkspace } from '@/server/tools/workspace'

function resolveAndValidate(inputPath: string, workspace: string): string {
  const absPath = resolve(workspace, inputPath)
  if (!absPath.startsWith(workspace)) {
    throw new Error('Path must be within the workspace')
  }
  if (!existsSync(absPath)) {
    throw new Error(`File not found: ${inputPath}`)
  }
  return absPath
}

export const ocrFileTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: true,
  concurrencySafe: true,
  defaultDisabled: false,
  create: () =>
    tool({
      description:
        'Extract text from an image file using OCR (tesseract). ' +
        'Use this when you need to read text from a screenshot, document scan, or any image file ' +
        'that was sent to you (e.g., via Telegram). Returns the extracted text. ' +
        'Works with PNG, JPEG, TIFF, BMP, and other image formats supported by tesseract. ' +
        '**Note**: This extracts TEXT only — it cannot describe visual content like photos.',
      inputSchema: z.object({
        path: z.string().describe('Path to the image file (relative to workspace or absolute).'),
      }),
      execute: async ({ path: filePath }, ctx) => {
        const workspace = resolveToolWorkspace(ctx)
        let absPath: string
        try {
          absPath = resolveAndValidate(filePath, workspace)
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }
        }

        try {
          const text = execFileSync('tesseract', [absPath, '-'], {
            timeout: 30_000,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
          })

          const trimmed = text.trim()
          if (!trimmed) {
            return {
              success: true,
              text: '',
              warning: 'OCR completed but no text was found in the image. The image may not contain readable text (e.g., it could be a photo without text).',
            }
          }

          return {
            success: true,
            text: trimmed,
            charCount: trimmed.length,
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.includes('tesseract') && msg.includes('not found')) {
            return {
              success: false,
              error: 'tesseract is not installed on the server. Install with: sudo apt install tesseract-ocr',
            }
          }
          return {
            success: false,
            error: `OCR failed: ${msg}`,
          }
        }
      },
    }),
}

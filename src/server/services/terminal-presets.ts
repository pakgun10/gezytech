import { eq, and } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { terminalPresets } from '@/server/db/schema'
import { sseManager } from '@/server/sse/index'
import type { TerminalPresetDTO } from '@/shared/types'

/**
 * Per-user terminal session presets: a saved working directory + init script so
 * a new session opens straight in the right place and runs a startup command
 * (e.g. `claude ...`). CRUD lives here (DB-backed) rather than in
 * `terminal-sessions.ts`, which stays a pure, DB-free state machine.
 */

const NAME_MAX = 60
const CWD_MAX = 500
const INIT_SCRIPT_MAX = 8000

type PresetRow = typeof terminalPresets.$inferSelect

function toDTO(row: PresetRow): TerminalPresetDTO {
  return {
    id: row.id,
    name: row.name,
    cwd: row.cwd ?? null,
    initScript: row.initScript ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function listPresets(userId: string): TerminalPresetDTO[] {
  return db
    .select()
    .from(terminalPresets)
    .where(eq(terminalPresets.userId, userId))
    .all()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(toDTO)
}

export function getPreset(id: string, userId: string): TerminalPresetDTO | null {
  const row = db
    .select()
    .from(terminalPresets)
    .where(and(eq(terminalPresets.id, id), eq(terminalPresets.userId, userId)))
    .get()
  return row ? toDTO(row) : null
}

function notifyPresetsChanged(userId: string) {
  // Optional call: partial sse mocks in tests (mock.module is process-global).
  sseManager.sendToUser?.(userId, {
    type: 'terminal:presets-changed',
    data: { presets: listPresets(userId) },
  })
}

interface PresetInput {
  name?: unknown
  cwd?: unknown
  initScript?: unknown
}

/** Normalize a value to a trimmed, length-capped string or null. */
function cleanField(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

export function createPreset(userId: string, input: PresetInput): TerminalPresetDTO | null {
  const name = cleanField(input.name, NAME_MAX)
  if (!name) return null
  const now = Date.now()
  const row = {
    id: crypto.randomUUID(),
    userId,
    name,
    cwd: cleanField(input.cwd, CWD_MAX),
    initScript: cleanField(input.initScript, INIT_SCRIPT_MAX),
    createdAt: now,
    updatedAt: now,
  }
  db.insert(terminalPresets).values(row).run()
  notifyPresetsChanged(userId)
  return toDTO(row)
}

export function updatePreset(id: string, userId: string, input: PresetInput): TerminalPresetDTO | null {
  const existing = db
    .select()
    .from(terminalPresets)
    .where(and(eq(terminalPresets.id, id), eq(terminalPresets.userId, userId)))
    .get()
  if (!existing) return null
  const name = cleanField(input.name, NAME_MAX)
  if (!name) return null
  db.update(terminalPresets)
    .set({
      name,
      cwd: cleanField(input.cwd, CWD_MAX),
      initScript: cleanField(input.initScript, INIT_SCRIPT_MAX),
      updatedAt: Date.now(),
    })
    .where(eq(terminalPresets.id, id))
    .run()
  notifyPresetsChanged(userId)
  return getPreset(id, userId)
}

export function deletePreset(id: string, userId: string): boolean {
  const existing = getPreset(id, userId)
  if (!existing) return false
  db.delete(terminalPresets)
    .where(and(eq(terminalPresets.id, id), eq(terminalPresets.userId, userId)))
    .run()
  notifyPresetsChanged(userId)
  return true
}

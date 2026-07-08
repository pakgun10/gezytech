import { db } from '@/server/db/index'
import { cronLearnings } from '@/server/db/schema'
import { eq, asc, desc, count } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { createLogger } from '@/server/logger'

const log = createLogger('cron-learnings')

/** Maximum number of learnings stored per cron. Oldest are evicted (FIFO). */
const MAX_LEARNINGS_PER_CRON = 20

/**
 * Save a learning for a cron. Deduplicates by exact content (trimmed, case-insensitive).
 * Evicts oldest learnings when the per-cron cap is reached.
 */
export async function saveCronLearning(
  cronId: string,
  content: string,
  category?: string | null,
  taskId?: string | null,
) {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Learning content cannot be empty')

  // Deduplication: check if an identical learning already exists
  const existing = db
    .select()
    .from(cronLearnings)
    .where(eq(cronLearnings.cronId, cronId))
    .all()

  const duplicate = existing.find(
    (l) => l.content.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  if (duplicate) {
    log.debug({ cronId, learningId: duplicate.id }, 'Duplicate learning — skipping')
    return duplicate
  }

  // Evict oldest if cap is reached
  if (existing.length >= MAX_LEARNINGS_PER_CRON) {
    const toEvict = existing.length - MAX_LEARNINGS_PER_CRON + 1
    const oldest = db
      .select({ id: cronLearnings.id })
      .from(cronLearnings)
      .where(eq(cronLearnings.cronId, cronId))
      .orderBy(asc(cronLearnings.createdAt))
      .limit(toEvict)
      .all()

    for (const o of oldest) {
      await db.delete(cronLearnings).where(eq(cronLearnings.id, o.id))
    }
    log.debug({ cronId, evicted: oldest.length }, 'Evicted oldest learnings')
  }

  const id = uuid()
  const now = new Date()
  await db.insert(cronLearnings).values({
    id,
    cronId,
    content: trimmed,
    category: category ?? null,
    taskId: taskId ?? null,
    createdAt: now,
  })

  log.info({ cronId, learningId: id, category }, 'Cron learning saved')

  return { id, cronId, content: trimmed, category: category ?? null, taskId: taskId ?? null, createdAt: now }
}

/**
 * Delete a cron learning by ID.
 */
export async function deleteCronLearning(learningId: string): Promise<boolean> {
  const result = db.delete(cronLearnings).where(eq(cronLearnings.id, learningId)).run() as unknown as { changes: number }
  return result.changes > 0
}

/**
 * Fetch all learnings for a cron, ordered oldest first (chronological).
 */
export function fetchCronLearnings(cronId: string, limit = MAX_LEARNINGS_PER_CRON) {
  return db
    .select({
      id: cronLearnings.id,
      content: cronLearnings.content,
      category: cronLearnings.category,
      createdAt: cronLearnings.createdAt,
    })
    .from(cronLearnings)
    .where(eq(cronLearnings.cronId, cronId))
    .orderBy(asc(cronLearnings.createdAt))
    .limit(limit)
    .all()
}

/**
 * Fetch learnings saved by a specific task run.
 */
export function fetchCronLearningsByTask(taskId: string) {
  return db
    .select({
      id: cronLearnings.id,
      content: cronLearnings.content,
      category: cronLearnings.category,
      createdAt: cronLearnings.createdAt,
    })
    .from(cronLearnings)
    .where(eq(cronLearnings.taskId, taskId))
    .orderBy(asc(cronLearnings.createdAt))
    .all()
}
